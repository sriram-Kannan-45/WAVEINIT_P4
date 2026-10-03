const artwork = "/intro/scroll-to-continue.png";

/** Responsive views of the supplied artwork keep its baked lettering intact. */
export function WelcomeArtwork() {
  return (
    <>
      <link rel="preload" as="image" href={artwork} fetchPriority="high" />
      <div className="intro-front-art" aria-hidden="true">
        {[
          ["top-left", "0 0 510 380"],
          ["top-right", "1280 0 520 380"],
          ["bottom-left", "0 495 520 379"],
          ["bottom-right", "1280 495 520 379"],
        ].map(([corner, viewBox]) => (
          <svg
            key={corner}
            className={`intro-front-corner intro-front-${corner}`}
            viewBox={viewBox}
          >
            <image href={artwork} width="1800" height="874" />
          </svg>
        ))}
      </div>
      <a className="intro-front-content" href="#peacock">
        <span className="sr-only">
          Scroll to Continue. Scroll down to reveal the video.
        </span>
        <svg viewBox="500 225 800 440" aria-hidden="true">
          <image href={artwork} width="1800" height="874" />
        </svg>
      </a>
    </>
  );
}
