"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, updatePassword } from "@/lib/admin-client";
export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const result = await login(new FormData(e.currentTarget));
          if (!result.ok) {
            setError(result.error || "Unable to sign in.");
          } else {
            router.push("/admin/dashboard");
            router.refresh();
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        <span>Admin ID or Email</span>
        <input
          type="text"
          name="email"
          required
          autoComplete="username"
          placeholder="e.g. achu"
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Signing in…" : "Sign in securely"}
      </button>
    </form>
  );
}
export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setPending(true);
        const result = await updatePassword(new FormData(form));
        setMessage(
          result.ok
            ? "Password updated."
            : result.error || "Unable to update password.",
        );
        if (result.ok) form.reset();
        setPending(false);
      }}
    >
      <h2>Change your password</h2>
      <div className="form-grid">
        <label className="field full">
          <span>Current password</span>
          <input
            type="password"
            name="current"
            required
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>New password (12 characters minimum)</span>
          <input
            type="password"
            name="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            type="password"
            name="confirm"
            required
            minLength={12}
            autoComplete="new-password"
          />
        </label>
      </div>
      <p role="status" className="summary-note">
        {message}
      </p>
      <div className="form-actions">
        <button className="button" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
