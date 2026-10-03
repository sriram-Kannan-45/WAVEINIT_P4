import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/admin/login-form";
import { configured } from "@/lib/supabase/server";
export const metadata = {
  title: "Owner sign in",
  robots: { index: false, follow: false },
};
export default function Login() {
  return (
    <div className="admin-login">
      <Image
        src="/brand/achu-designer-boutique-logo.png"
        style={{ height: "auto" }}
        alt="Achu Designer Boutique official logo"
        width={110}
        height={117}
        loading="eager"
      />
      <div className="login-card">
        <p className="eyebrow">THE OWNER’S SPACE</p>
        <h1>Welcome to Achu.</h1>
        <p>Sign in to care for your collection.</p>
        {!configured() && (
          <div className="setup-note">
            Owner mode enabled. Sign in with Admin ID <strong>achu</strong> and
            password <strong>1234</strong>.
          </div>
        )}
        <LoginForm />
      </div>
      <Link href="/">← Return to the boutique</Link>
    </div>
  );
}
