
"use client";

import { useEffect, useState } from "react";
import {
  createRoom,
  createRoomInvitation,
  getMyRoom,
} from "../actions/rooms";

export default function RoomManager() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("Our Space");
  const [newRoomName, setNewRoomName] = useState("Our Space");
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refreshRoom() {
    setLoading(true);
    const result = await getMyRoom();
    setRoomId(result.roomId);
    if (result.roomName) {
      setRoomName(result.roomName);
      setNewRoomName(result.roomName);
    }
    setMessage(result.error ?? "");
    setLoading(false);
  }

  useEffect(() => {
    void refreshRoom();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setInviteUrl("");

    const result = await createRoom(newRoomName);

    if (result.success) {
      setRoomId(result.roomId);
      setRoomName(newRoomName.trim() || "Our Space");
      setMessage("Your space has been created.");
    } else {
      setMessage(result.error);
    }

    setBusy(false);
  }

  async function handleInvite() {
    if (!roomId) return;

    setBusy(true);
    setMessage("");
    setInviteUrl("");

    const result = await createRoomInvitation(roomId);

    if (result.success && result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      setMessage("Invitation created. It expires in 24 hours.");
    } else {
      setMessage(result.success ? "" : result.error);
    }

    setBusy(false);
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Invitation link copied.");
    } catch {
      setMessage("Copy failed. Select and copy the link manually.");
    }
  }

  if (loading) {
    return <main style={pageStyle}>Loading your space…</main>;
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <a href="/" style={{ color: "#704b42" }}>← Back to dashboard</a>
        <h1 style={{ fontSize: 30, marginBottom: 4 }}>Your Us Space</h1>
        <p style={{ color: "#705f59" }}>
          Create a private room for the two of you, then invite your partner.
        </p>

        {!roomId ? (
          <form onSubmit={handleCreate} style={stackStyle}>
            <label>
              Name your space
              <input
                value={newRoomName}
                onChange={(event) => setNewRoomName(event.target.value)}
                maxLength={80}
                required
                style={inputStyle}
              />
            </label>
            <button disabled={busy} style={buttonStyle}>
              {busy ? "Creating…" : "Create our space"}
            </button>
          </form>
        ) : (
          <div style={stackStyle}>
            <h2 style={{ fontSize: 22 }}>{roomName}</h2>
            <p>Your room is ready. Create an invitation for your partner.</p>
            <button onClick={handleInvite} disabled={busy} style={buttonStyle}>
              {busy ? "Please wait…" : "Create invitation link"}
            </button>

            {inviteUrl && (
              <div style={stackStyle}>
                <label>
                  Invitation link
                  <input readOnly value={inviteUrl} style={inputStyle} />
                </label>
                <button onClick={copyInvite} style={buttonStyle}>
                  Copy invitation link
                </button>
                <p style={{ fontSize: 13 }}>
                  Treat this link like a key to your private space. Anyone who
                  has it can attempt to join before it expires or is used.
                </p>
              </div>
            )}
          </div>
        )}

        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  display: "grid",
  placeItems: "center",
  background: "#f7f0eb",
  color: "#352a28",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  boxSizing: "border-box",
  padding: 28,
  display: "grid",
  gap: 16,
  border: "1px solid #e5dcd5",
  borderRadius: 20,
  background: "#fffaf6",
};

const stackStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const inputStyle: React.CSSProperties = {
  display: "block",
  boxSizing: "border-box",
  width: "100%",
  marginTop: 6,
  padding: 12,
  border: "1px solid #d8c9c0",
  borderRadius: 10,
  background: "white",
  color: "#352a28",
};

const buttonStyle: React.CSSProperties = {
  padding: 12,
  border: 0,
  borderRadius: 10,
  background: "#704b42",
  color: "white",
  cursor: "pointer",
  fontSize: 15,
};
