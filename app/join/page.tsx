
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { joinRoomByInvitation } from "../actions/rooms";

export default function JoinPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Checking your invitation...");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function join() {
      // Read the invitation token only in the browser.
      const token = new URLSearchParams(window.location.search).get("token");

      if (!token) {
        setStatus("Invalid invitation");
        setError("This link does not contain an invitation token.");
        return;
      }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !data.user) {
        setStatus("Sign in to join");
        setError(
          "Sign in or create an account first, then reopen the original invitation link."
        );
        return;
      }

      setStatus("Joining your shared space...");
      setError("");

      const result = await joinRoomByInvitation(token);

      if (cancelled) return;

      if (!result.success) {
        setStatus("Unable to join");
        setError(result.error);
        return;
      }

      setStatus("You joined the shared space!");
      router.replace("/room");
    }

    void join();

    return () => {
      cancelled = true;
    };
  }, [retry, router]);

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "80px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Join Our Space</h1>
      <p>{status}</p>

      {error && <p role="alert">{error}</p>}

      {status === "Sign in to join" && (
        <p>
          <a href="/login">Sign in or create an account</a>
        </p>
      )}

      {status === "Unable to join" && (
        <button onClick={() => setRetry((value) => value + 1)}>
          Try again
        </button>
      )}
    </main>
  );
}
