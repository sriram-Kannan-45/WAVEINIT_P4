"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="admin-panel">
      <h2>We couldn’t load this section.</h2>
      <p className="muted">
        Check your connection and database setup, then try again.
      </p>
      <button className="button" onClick={reset} style={{ marginTop: 20 }}>
        Try again
      </button>
    </div>
  );
}
