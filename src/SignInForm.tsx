"use client";
import { t as tr, useLocale } from "./i18n";


import { LanguageSelector } from "./components/LanguageSelector";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

type Mode = "signIn" | "signUp" | "forgot" | "resetCode";

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function GoogleIcon() {
  useLocale();
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.24-.2-1.8H12v3.4h5.52a4.72 4.72 0 0 1-2.05 3.1l-.02.11 2.98 2.31.2.02c1.84-1.7 2.97-4.2 2.97-7.14Z" />
      <path fill="#34A853" d="M12 22c2.68 0 4.93-.88 6.57-2.4l-3.13-2.43c-.84.57-1.97.97-3.44.97-2.58 0-4.77-1.74-5.55-4.15l-.1.01-3.1 2.4-.03.09A9.93 9.93 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.45 13.99A6 6 0 0 1 6.12 12c0-.7.12-1.38.32-2l-.01-.13-3.14-2.44-.1.05A10.02 10.02 0 0 0 2 12c0 1.62.39 3.15 1.08 4.5l3.37-2.51Z" />
      <path fill="#EA4335" d="M12 5.86c1.87 0 3.13.8 3.85 1.47l2.79-2.72C16.92 3.01 14.68 2 12 2a9.93 9.93 0 0 0-8.78 5.49L6.44 10C7.23 7.6 9.42 5.86 12 5.86Z" />
    </svg>
  );
}

export function SignInForm() {
  useLocale();
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const desktopApp = useMemo(() => isTauri(), []);
  const passwordRecoveryEnabled = import.meta.env.VITE_PASSWORD_RECOVERY_ENABLED === "true";

  const inputClass = "auth-input-field auth-input-modern";

  const switchMode = (next: Mode) => {
    setMode(next);
    setResetCode("");
  };

  const handleGoogle = async () => {
    if (desktopApp) {
      toast(tr("Google sign-in currently opens from the web version. Use email in the Windows app."));
      return;
    }
    setSubmitting(true);
    try {
      await signIn("google");
    } catch (error: any) {
      toast.error(error?.message ?? tr("Could not start Google sign-in"));
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const normalizedEmail = String(formData.get("email") ?? email).trim().toLowerCase();
    if (normalizedEmail) setEmail(normalizedEmail);

    try {
      if (mode === "signUp") {
        const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
        const password = String(formData.get("password") ?? "");
        const confirmPassword = String(formData.get("confirmPassword") ?? "");
        if (name.length < 2) throw new Error(tr("Enter your name"));
        if (password.length < 8) throw new Error(tr("Password must be at least 8 characters"));
        if (password !== confirmPassword) throw new Error(tr("Passwords do not match"));
        sessionStorage.setItem("pending_display_name", name);
        await signIn("password", { flow: "signUp", email: normalizedEmail, password });
        return;
      }

      if (mode === "signIn") {
        const password = String(formData.get("password") ?? "");
        await signIn("password", { flow: "signIn", email: normalizedEmail, password });
        return;
      }

      if (mode === "forgot") {
        await signIn("password", { flow: "reset", email: normalizedEmail });
        setEmail(normalizedEmail);
        setMode("resetCode");
        toast.success(tr("Reset code sent"));
        return;
      }

      const newPassword = String(formData.get("newPassword") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      if (!/^\d{6}$/.test(resetCode)) throw new Error(tr("Enter the 6-digit code"));
      if (newPassword.length < 8) throw new Error(tr("Password must be at least 8 characters"));
      if (newPassword !== confirmPassword) throw new Error(tr("Passwords do not match"));
      await signIn("password", {
        flow: "reset-verification",
        email,
        code: resetCode,
        newPassword,
      });
      toast.success(tr("Password updated"));
    } catch (error: any) {
      if (mode === "signUp") sessionStorage.removeItem("pending_display_name");
      const message = String(error?.message ?? "");
      if (/invalid credentials|invalid password/i.test(message)) toast.error(tr("Email or password is incorrect"));
      else toast.error(message || tr("Something went wrong. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "signUp" ? tr("Create your account") : mode === "forgot" ? tr("Reset your password") : mode === "resetCode" ? tr("Check your email") : tr("Welcome back");
  const subtitle = mode === "signUp"
    ? tr("Set up your personal system in less than a minute.")
    : mode === "forgot"
      ? tr("We’ll send a 6-digit reset code to your email.")
      : mode === "resetCode"
        ? tr("Enter the code sent to {0}.", {0: email})
        : tr("Sign in and continue where you left off.");

  return (
    <div className="auth-card-modern">
      <div className="mb-5 flex justify-end"><LanguageSelector /></div>
      <div className="mb-6">
        <div className="auth-card-kicker">{tr("Ceventic account")}</div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[1.7rem]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/45">{subtitle}</p>
      </div>

      {(mode === "signIn" || mode === "signUp") && (
        <>
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={submitting}
            className="auth-google-button"
          >
            <GoogleIcon />
            <span>{desktopApp ? tr("Google sign-in — web") : tr("Continue with Google")}</span>
          </button>
          <div className="auth-divider"><span>{tr("or continue with email")}</span></div>
        </>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === "signUp" && (
          <input className={inputClass} type="text" name="name" placeholder={tr("Your name")} maxLength={32} autoComplete="name" required />
        )}

        {mode !== "resetCode" && (
          <input
            className={inputClass}
            type="email" dir="ltr"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={tr("Email")}
            autoComplete="email"
            required
          />
        )}

        {(mode === "signIn" || mode === "signUp") && (
          <input className={inputClass} type="password" name="password" placeholder={tr("Password")} autoComplete={mode === "signUp" ? "new-password" : "current-password"} minLength={8} required />
        )}

        {mode === "signUp" && (
          <input className={inputClass} type="password" name="confirmPassword" placeholder={tr("Confirm password")} autoComplete="new-password" minLength={8} required />
        )}

        {mode === "resetCode" && (
          <>
            <input
              className={`${inputClass} text-center text-lg font-bold tracking-[0.28em]`}
              value={resetCode}
              onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" dir="ltr"
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
            <input className={inputClass} type="password" name="newPassword" placeholder={tr("New password")} autoComplete="new-password" minLength={8} required />
            <input className={inputClass} type="password" name="confirmPassword" placeholder={tr("Confirm new password")} autoComplete="new-password" minLength={8} required />
          </>
        )}

        <button className="auth-primary-button" type="submit" disabled={submitting}>
          {submitting ? tr("Please wait…") : mode === "signUp" ? tr("Create account") : mode === "forgot" ? tr("Send reset code") : mode === "resetCode" ? tr("Update password") : tr("Sign in")}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm text-white/42">
        {mode === "signIn" && (
          <>
            {passwordRecoveryEnabled && (
              <>
                <button onClick={() => switchMode("forgot")} className="auth-text-button">{tr("Forgot password?")}</button>
                <span className="text-white/15">•</span>
              </>
            )}
            <span>{tr("New here?")}</span>
            <button onClick={() => switchMode("signUp")} className="auth-text-button">{tr("Create account")}</button>
          </>
        )}
        {mode === "signUp" && (
          <><span>{tr("Already have an account?")}</span><button onClick={() => switchMode("signIn")} className="auth-text-button">{tr("Sign in")}</button></>
        )}
        {(mode === "forgot" || mode === "resetCode") && (
          <button onClick={() => switchMode("signIn")} className="auth-text-button">{tr("← Back to sign in")}</button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-white/[0.06] pt-4 text-[11px] text-white/28">
        <a href={desktopApp ? "#/privacy" : "/privacy"} className="transition hover:text-white/60">{tr("Privacy")}</a>
        <span>•</span>
        <a href={desktopApp ? "#/terms" : "/terms"} className="transition hover:text-white/60">{tr("Terms")}</a>
        <span>•</span>
        <a href={desktopApp ? "#/delete-account" : "/delete-account"} className="transition hover:text-white/60">{tr("Delete account")}</a>
      </div>
    </div>
  );
}
