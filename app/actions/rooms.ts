
"use server";

import { createHash, randomBytes } from "crypto";
import { createClient } from "../../lib/supabase/server";

type ActionResult =
  | { success: true; roomId: string; inviteUrl?: string }
  | { success: false; error: string };

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Please sign in before continuing.");
  }

  return { supabase, user };
}

export async function createRoom(
  name: string
): Promise<ActionResult> {
  try {
    const { supabase } = await getAuthenticatedUser();

    const { data: roomId, error } = await supabase.rpc("create_room", {
      p_name: name.trim().slice(0, 80) || "Our Space",
    });

    if (error) throw error;

    return { success: true, roomId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create room.",
    };
  }
}

export async function createRoomInvitation(
  roomId: string
): Promise<ActionResult> {
  try {
    const { supabase } = await getAuthenticatedUser();

    // 32 random bytes make the invitation token difficult to guess.
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { error } = await supabase.rpc("create_room_invitation", {
      p_room_id: roomId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt.toISOString(),
    });

    if (error) throw error;

    const siteUrl =
  process.env.NODE_ENV === "production"
    ? "https://us-space-starter.vercel.app"
    : "http://localhost:3000";

    return {
      success: true,
      roomId,
      inviteUrl: `${siteUrl.replace(/\/$/, "")}/join?token=${token}`,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not create an invitation.",
    };
  }
}

export async function joinRoomByInvitation(
  token: string
): Promise<ActionResult> {
  try {
    const { supabase } = await getAuthenticatedUser();

    // Reject malformed or excessively long tokens before querying the database.
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      throw new Error("This invitation link is invalid.");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const { data: roomId, error } = await supabase.rpc(
      "join_room_by_invitation",
      { p_token_hash: tokenHash }
    );

    if (error) throw error;

    return { success: true, roomId };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not join this room.",
    };
  }
}

export async function getMyRoom(): Promise<{
  roomId: string | null;
  roomName: string | null;
  error?: string;
}> {
  try {
    const { supabase, user } = await getAuthenticatedUser();

    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership) {
      return { roomId: null, roomName: null };
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, name")
      .eq("id", membership.room_id)
      .single();

    if (roomError) throw roomError;

    return { roomId: room.id, roomName: room.name };
  } catch (error) {
    return {
      roomId: null,
      roomName: null,
      error: error instanceof Error ? error.message : "Could not load your room.",
    };
  }
}
