import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-page">
      <p className="eyebrow">A LITTLE DETOUR</p>
      <h1>We couldn’t find this page.</h1>
      <p>Let’s find something beautiful instead.</p>
      <div className="button-row">
        <Link className="button" href="/">
          Return to home
        </Link>
        <Link className="button outline" href="/shop">
          Shop the collection
        </Link>
      </div>
    </div>
  );
}
