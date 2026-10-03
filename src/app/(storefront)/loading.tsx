export default function Loading() {
  return (
    <div
      className="container section"
      aria-label="Loading collection"
      aria-busy="true"
    >
      <div
        className="skeleton skeleton-line"
        style={{ width: "35%", height: 40, marginBottom: 35 }}
      />
      <div className="product-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="skeleton skeleton-image" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" style={{ width: "35%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
