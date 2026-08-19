"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "./contexts/ThemeContext";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const glow = colors.primary.replace("rgb(", "rgba(").replace(")", ",0.16)");

  const themedButton =
    `w-full px-4 py-3 rounded-lg font-semibold transition-all duration-300 ` +
    `bg-[image:var(--sw-gradient)] text-black ` +
    `hover:brightness-110 active:scale-[0.99] ` +
    `disabled:opacity-60 disabled:cursor-not-allowed`;

  const anonButton =
    `w-full px-4 py-3 rounded-lg font-semibold transition-all duration-300 ` +
    `bg-[image:var(--sw-gradient)] text-black ` +
    `hover:brightness-110 active:scale-[0.99]`;

  const inputClass = "auth-input-field";

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);

          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <input
          className={inputClass}
          type="email"
          name="email"
          placeholder="Email"
          required
        />

        <input
          className={inputClass}
          type="password"
          name="password"
          placeholder="Password"
          required
        />

        {/* ✅ Theme-aware main button */}
        <button className={themedButton} type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>

        <div className="text-center text-sm text-secondary">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-gray-200/20" />
        <span className="mx-4 text-secondary">or</span>
        <hr className="my-4 grow border-gray-200/20" />
      </div>

      {/* ✅ Theme-aware anonymous button */}
      <button
        className={anonButton}
        style={{ boxShadow: `0 0 22px ${glow}` }}
        onClick={() => void signIn("anonymous")}
      >
        Sign in anonymously
      </button>
    </div>
  );
}
