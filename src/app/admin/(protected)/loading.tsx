export default function Loading() {
  return (
    <div aria-label="Loading owner panel" aria-busy="true" style={{ animation: "fade-in 0.15s ease-out" }}>
      <div className="admin-page-title">
        <div>
          <div className="skeleton skeleton-line" style={{ height: 12, width: 140, marginBottom: 8 }} />
          <div className="skeleton skeleton-line" style={{ height: 36, width: 280 }} />
        </div>
        <div className="skeleton" style={{ height: 42, width: 130, borderRadius: 25 }} />
      </div>
      <div className="admin-grid">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="stat-card skeleton-card">
            <div className="skeleton skeleton-line" style={{ height: 12, width: "50%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 32, width: "35%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
