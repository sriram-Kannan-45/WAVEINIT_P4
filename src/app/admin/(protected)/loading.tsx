export default function Loading() {
  return (
    <div aria-label="Loading owner panel" aria-busy="true">
      <div
        className="skeleton skeleton-line"
        style={{ height: 35, width: "35%", marginBottom: 30 }}
      />
      <div className="admin-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 120 }} />
        ))}
      </div>
    </div>
  );
}
