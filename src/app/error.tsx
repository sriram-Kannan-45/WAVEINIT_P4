"use client";
import Link from "next/link";
export default function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">A MOMENTARY PAUSE</p>
      <h1>We couldn’t load the boutique.</h1>
      <p>Please check your connection and try again.</p>
      <div className="button-row">
        <button className="button" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="button outline">
          Return to home
        </Link>
      </div>
    </main>
  );
}
