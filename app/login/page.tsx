
"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "Account created. Check your email for a confirmation link before logging in."
          );
        } else {
          router.replace("/");
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 400,
          display: "grid",
          gap: 16,
          padding: 28,
          border: "1px solid #e5dcd5",
          borderRadius: 20,
          background: "#fffaf6",
          color: "#352a28",
        }}
      >
        <h1 style={{ fontSize: 30, margin: 0 }}>Us Space</h1>
        <p style={{ margin: 0 }}>
          {mode === "login"
            ? "Sign in to your space together."
            : "Create your account to begin."}
        </p>

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={inputStyle}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          style={{
            ...buttonStyle,
            background: "transparent",
            color: "#704b42",
          }}
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already registered? Sign in"}
        </button>

        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}

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
  border: "1px solid #d8c9c0",
  borderRadius: 10,
  background: "#704b42",
  color: "white",
  cursor: "pointer",
  fontSize: 15,
};
