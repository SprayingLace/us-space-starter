import MovieLounge from "./MovieLounge";

export default function MovieLoungePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 20px",
        display: "grid",
        placeItems: "center",
        background: "#f7f0eb",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          boxSizing: "border-box",
          padding: 24,
          border: "1px solid #e5dcd5",
          borderRadius: 20,
          background: "#fffaf6",
        }}
      >
        <a href="/" style={{ color: "#704b42", display: "inline-block", marginBottom: 20 }}>
          ← Back to Us Space
        </a>
        <MovieLounge />
      </div>
    </main>
  );
}
