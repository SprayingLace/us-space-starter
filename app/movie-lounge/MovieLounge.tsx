"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMyRoom } from "../actions/rooms";
import { createClient } from "../../lib/supabase/client";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type LoungeSession = {
  room_id: string;
  video_id: string | null;
  current_time: number;
  is_playing: boolean;
  updated_by: string | null;
  updated_at: string;
};

type PlayerLike = {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData: () => { video_id?: string };
  destroy: () => void;
};

function extractYouTubeId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id: string | null = null;

    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0] ?? "")) id = parts[1] ?? null;
      }
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function MovieLounge() {
  const [supabase] = useState(() => createClient());
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerLike | null>(null);
  const playerReadyRef = useRef(false);
  const channelRef = useRef<any>(null);
  const sessionRef = useRef<LoungeSession | null>(null);
  const userIdRef = useRef<string | null>(null);
  const applyToPlayerRef = useRef<(next: LoungeSession) => void>(() => {});
  const [roomId, setRoomId] = useState<string | null>(null);
  const [session, setSession] = useState<LoungeSession | null>(null);
  const [url, setUrl] = useState("");
  const [draftTime, setDraftTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Connect your room to start a shared movie night.");

  const setCurrentSession = useCallback((next: LoungeSession) => {
    sessionRef.current = next;
    setSession(next);
    setDraftTime(next.current_time || 0);
  }, []);

  const applyToPlayer = useCallback((next: LoungeSession) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current || !next.video_id) return;

    const updatedAt = Date.parse(next.updated_at);
    const elapsed = next.is_playing && Number.isFinite(updatedAt)
      ? Math.max(0, (Date.now() - updatedAt) / 1000)
      : 0;
    const targetTime = Math.max(0, next.current_time + elapsed);
    const currentId = player.getVideoData?.()?.video_id;

    if (currentId !== next.video_id) {
      if (next.is_playing) player.loadVideoById({ videoId: next.video_id, startSeconds: targetTime });
      else player.cueVideoById({ videoId: next.video_id, startSeconds: targetTime });
    } else {
      const currentTime = player.getCurrentTime?.() ?? 0;
      if (Math.abs(currentTime - targetTime) > 1.25) player.seekTo(targetTime, true);
      if (next.is_playing) player.playVideo();
      else player.pauseVideo();
    }
  }, []);

  useEffect(() => {
    applyToPlayerRef.current = applyToPlayer;
  }, [applyToPlayer]);

  const saveSession = useCallback(async (patch: {
    video_id?: string | null;
    current_time?: number;
    is_playing?: boolean;
  }) => {
    if (!roomId || !userIdRef.current) return;
    const previous = sessionRef.current;
    const next: LoungeSession = {
      room_id: roomId,
      video_id: patch.video_id !== undefined ? patch.video_id : previous?.video_id ?? null,
      current_time: patch.current_time !== undefined ? Math.max(0, patch.current_time) : previous?.current_time ?? 0,
      is_playing: patch.is_playing !== undefined ? patch.is_playing : previous?.is_playing ?? false,
      updated_by: userIdRef.current,
      updated_at: new Date().toISOString(),
    };

    setCurrentSession(next);
    applyToPlayerRef.current(next);
    const { error: writeError } = await supabase
      .from("movie_lounge_sessions")
      .upsert(next, { onConflict: "room_id" });

    if (writeError) {
      setError(`Could not sync playback: ${writeError.message}`);
    } else {
      setError("");
    }
  }, [roomId, setCurrentSession, supabase]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      setLoading(true);
      setError("");

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setError("Please sign in before opening Movie Lounge.");
        setLoading(false);
        return;
      }
      userIdRef.current = authData.user.id;

      const room = await getMyRoom();
      if (!active) return;
      if (!room.roomId) {
        setError(room.error || "Create or join your Us Space room before starting a movie.");
        setLoading(false);
        return;
      }

      const currentRoomId = room.roomId;
      setRoomId(currentRoomId);

      const channel = supabase
        .channel(`movie-lounge:${currentRoomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "movie_lounge_sessions",
            filter: `room_id=eq.${currentRoomId}`,
          },
          (payload: any) => {
            const row = (payload.new ?? null) as LoungeSession | null;
            if (!row || row.room_id !== currentRoomId) return;
            if (row.updated_by === userIdRef.current) return;
            setCurrentSession(row);
            applyToPlayerRef.current(row);
            setNotice(row.is_playing ? "Your partner is watching with you." : "Shared playback is paused.");
          },
        );

      channelRef.current = channel;
      channel.subscribe(async (status: string) => {
        if (!active || status !== "SUBSCRIBED") return;

        const { error: seedError } = await supabase
          .from("movie_lounge_sessions")
          .upsert(
            {
              room_id: currentRoomId,
              video_id: null,
              current_time: 0,
              is_playing: false,
              updated_by: authData.user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "room_id", ignoreDuplicates: true },
          );

        if (seedError) {
          setError(`Could not initialize Movie Lounge: ${seedError.message}`);
          setLoading(false);
          return;
        }

        const { data, error: readError } = await supabase
          .from("movie_lounge_sessions")
          .select("room_id, video_id, current_time, is_playing, updated_by, updated_at")
          .eq("room_id", currentRoomId)
          .single();

        if (!active) return;
        if (readError || !data) {
          setError(readError?.message || "Could not load shared playback.");
        } else {
          const row = data as LoungeSession;
          setCurrentSession(row);
          applyToPlayerRef.current(row);
          setNotice(row.video_id ? "Shared session connected." : "Paste a YouTube link to begin.");
        }
        setLoading(false);
      });
    };

    void initialize();

    return () => {
      active = false;
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [supabase, setCurrentSession]);

  useEffect(() => {
    if (window.YT?.Player) {
      setApiReady(true);
      return;
    }

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      setApiReady(true);
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.youtubeIframeApi = "true";
      document.head.appendChild(script);
    }

    return () => {
      if (window.onYouTubeIframeAPIReady) {
        window.onYouTubeIframeAPIReady = previousCallback;
      }
    };
  }, []);

  useEffect(() => {
    if (!apiReady || loading || !roomId || !playerHostRef.current || playerRef.current) return;

    const player = new window.YT.Player(playerHostRef.current, {
      width: "100%",
      height: "100%",
      playerVars: {
        controls: 0,
        rel: 0,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: { target: PlayerLike }) => {
          playerRef.current = event.target;
          playerReadyRef.current = true;
          setPlayerReady(true);
          const current = sessionRef.current;
          if (current) applyToPlayerRef.current(current);
        },
        onStateChange: () => {
          const current = sessionRef.current;
          const playerInstance = playerRef.current;
          if (current && playerInstance) {
            setDraftTime(playerInstance.getCurrentTime?.() ?? current.current_time);
            setDuration(playerInstance.getDuration?.() ?? 0);
          }
        },
        onError: (event: { data: number }) => {
          const details: Record<number, string> = {
            2: "That YouTube video ID is invalid.",
            5: "This video cannot be played in the embedded player.",
            100: "This video was removed or is unavailable.",
            101: "The video owner does not allow embedded playback.",
            150: "The video owner does not allow embedded playback.",
          };
          setError(details[event.data] || "YouTube could not play this video. Try another link.");
        },
      },
    });

    playerRef.current = player;

    return () => {
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
      playerReadyRef.current = false;
      setPlayerReady(false);
    };
  }, [apiReady, loading, roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = sessionRef.current;
      const player = playerRef.current;
      if (!current || !player) return;
      setDraftTime(player.getCurrentTime?.() ?? current.current_time);
      setDuration(player.getDuration?.() ?? 0);

      if (current.video_id && current.is_playing && player.getPlayerState?.() === 1) {
        const updatedAt = Date.parse(current.updated_at);
        const expected = current.current_time + (Number.isFinite(updatedAt) ? Math.max(0, (Date.now() - updatedAt) / 1000) : 0);
        const actual = player.getCurrentTime?.() ?? expected;
        if (Math.abs(actual - expected) > 2.5) player.seekTo(expected, true);
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, []);

  const loadVideo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      setError("Paste a valid YouTube watch, share, Shorts, or embed URL.");
      return;
    }
    setBusy(true);
    setError("");
    await saveSession({ video_id: videoId, current_time: 0, is_playing: false });
    setNotice("Movie loaded for both of you. Press play when you're ready.");
    setBusy(false);
  };

  const togglePlayback = async () => {
    if (!session?.video_id) {
      setError("Load a YouTube video first.");
      return;
    }
    const player = playerRef.current;
    const currentTime = player?.getCurrentTime?.() ?? session.current_time;
    const nextPlaying = !session.is_playing;
    await saveSession({ current_time: currentTime, is_playing: nextPlaying });
    setNotice(nextPlaying ? "Play sent to both screens." : "Pause sent to both screens.");
  };

  const commitSeek = async () => {
    const target = Math.max(0, Math.min(draftTime, duration || draftTime));
    await saveSession({ current_time: target });
    setNotice("Playback position synced.");
  };

  const copyLink = async () => {
    if (!session?.video_id) return;
    const shareUrl = `https://www.youtube.com/watch?v=${session.video_id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("YouTube link copied.");
    } catch {
      setNotice(shareUrl);
    }
  };

  return (
    <section style={styles.shell}>
      <div style={styles.headingRow}>
        <div>
          <p style={styles.eyebrow}>THE TWO-SEAT CINEMA</p>
          <h2 style={styles.title}>Movie night, together.</h2>
          <p style={styles.subheading}>Either of you can control the movie. Your room shares one playback state.</p>
        </div>
        <span style={styles.filmIcon}>▶</span>
      </div>

      {loading ? (
        <p style={styles.notice}>Connecting to your private room…</p>
      ) : (
        <>
          <div style={styles.playerFrame}>
            <div ref={playerHostRef} style={styles.playerHost} />
            {!session?.video_id && (
              <div style={styles.emptyPlayer}>
                <div style={styles.star}>✦　·　✧</div>
                <span style={styles.bigPlay}>▶</span>
                <strong>Your little cinema</strong>
                <span>Paste a YouTube link below to begin</span>
              </div>
            )}
          </div>

          <form onSubmit={loadVideo} style={styles.urlRow}>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a YouTube link…"
              aria-label="YouTube video URL"
              style={styles.urlInput}
            />
            <button type="submit" disabled={busy || !roomId} style={styles.primaryButton}>
              {busy ? "Loading…" : "Load movie"}
            </button>
          </form>

          <div style={styles.controls}>
            <button type="button" onClick={togglePlayback} disabled={!session?.video_id || !playerReady} style={styles.playButton}>
              {session?.is_playing ? "Ⅱ Pause" : "▶ Play"}
            </button>
            <span style={styles.time}>{formatTime(draftTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, duration || draftTime || 1)}
              value={Math.min(draftTime, Math.max(1, duration || draftTime || 1))}
              onChange={(event) => setDraftTime(Number(event.target.value))}
              onPointerUp={() => void commitSeek()}
              onKeyUp={() => void commitSeek()}
              disabled={!session?.video_id || !playerReady}
              aria-label="Seek movie"
              style={styles.seek}
            />
            <span style={styles.time}>{formatTime(duration)}</span>
          </div>

          <div style={styles.statusRow}>
            <span style={styles.statusDot} />
            <span>{notice}</span>
            {session?.video_id && <button type="button" onClick={copyLink} style={styles.copyButton}>Copy movie link</button>}
          </div>
        </>
      )}

      {error && <p role="alert" style={styles.error}>{error}</p>}
      <p style={styles.footnote}>
        Playback is synchronized through your room in Supabase. Some YouTube videos block embedding, and each person may need to start playback once if their browser blocks autoplay.
      </p>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: "100%",
    display: "grid",
    gap: 16,
    color: "#352a28",
  },
  headingRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#a16d62",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.16em",
  },
  title: { margin: 0, fontSize: 26, lineHeight: 1.2 },
  subheading: { margin: "8px 0 0", color: "#786761", fontSize: 14, lineHeight: 1.5 },
  filmIcon: {
    display: "grid",
    placeItems: "center",
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "#f3e4de",
    color: "#704b42",
    flexShrink: 0,
  },
  playerFrame: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    borderRadius: 16,
    background: "#171312",
    border: "1px solid #392c28",
  },
  playerHost: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  emptyPlayer: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "#f8eee8",
    background: "radial-gradient(circle at 50% 40%, #49312d 0%, #211918 65%, #171312 100%)",
    pointerEvents: "none",
  },
  star: { color: "#d8a69b", fontSize: 20 },
  bigPlay: {
    display: "grid",
    placeItems: "center",
    width: 54,
    height: 54,
    paddingLeft: 4,
    borderRadius: "50%",
    background: "#c77f72",
    color: "white",
    fontSize: 20,
  },
  urlRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  urlInput: {
    flex: "1 1 240px",
    minWidth: 0,
    padding: "12px 14px",
    border: "1px solid #e1d3cc",
    borderRadius: 10,
    background: "#fff",
    color: "#352a28",
    fontSize: 14,
  },
  primaryButton: {
    padding: "12px 16px",
    border: 0,
    borderRadius: 10,
    background: "#704b42",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  controls: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
  playButton: {
    padding: "10px 14px",
    border: 0,
    borderRadius: 10,
    background: "#f0ded7",
    color: "#704b42",
    fontWeight: 700,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  time: { fontVariantNumeric: "tabular-nums", color: "#715f58", fontSize: 12 },
  seek: { flex: 1, minWidth: 24, accentColor: "#a76559" },
  statusRow: { display: "flex", alignItems: "center", gap: 8, color: "#786761", fontSize: 13, flexWrap: "wrap" },
  statusDot: { width: 8, height: 8, borderRadius: "50%", background: "#78a58b", display: "inline-block", flexShrink: 0 },
  copyButton: {
    marginLeft: "auto",
    padding: "6px 10px",
    border: "1px solid #e1d3cc",
    borderRadius: 8,
    background: "#fffaf6",
    color: "#704b42",
    cursor: "pointer",
  },
  notice: { padding: 18, borderRadius: 12, background: "#fff5ef", color: "#786761" },
  error: { margin: 0, padding: 12, borderRadius: 10, background: "#fff0ee", color: "#a3382c", fontSize: 13 },
  footnote: { margin: 0, color: "#927f77", fontSize: 12, lineHeight: 1.55 },
};
