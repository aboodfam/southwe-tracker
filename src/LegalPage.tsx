import { LanguageSelector } from "./components/LanguageSelector";

import { t as tr, useLocale, getIntlLocale } from "./i18n";
import type { ReactNode } from "react";

type LegalKind = "privacy" | "terms" | "delete";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL?.trim() || "ceventic1@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  useLocale();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-white/62 sm:text-[15px]">{children}</div>
    </section>
  );
}

function LegalShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  useLocale();
  const desktopApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const href = (path: string) => (desktopApp ? `#${path}` : path);

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-5 flex justify-end"><LanguageSelector /></div>
        <a href={href("/")} className="inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white">
          <span aria-hidden="true">←</span> {tr("Back to Ceventic")} </a>

        <div className="mt-7 rounded-[28px] border border-white/10 bg-white/[0.025] p-5 shadow-2xl sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/35">{tr("Ceventic System")}</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/52 sm:text-[15px]">{intro}</p>
          <div className="mt-4 text-xs text-white/30">{tr("Last updated:")} {new Date("2026-08-21T12:00:00Z").toLocaleDateString(getIntlLocale(), {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"})}</div>

          <div className="mt-8 space-y-8 border-t border-white/8 pt-8">{children}</div>

          <div className="mt-9 border-t border-white/8 pt-6 text-sm leading-6 text-white/40">
            {tr("Questions, support, or privacy requests:")}{" "}
            <a className="text-white/70 underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-white/35">
          <a className="hover:text-white/70" href={href("/privacy")}>{tr("Privacy")}</a>
          <span>•</span>
          <a className="hover:text-white/70" href={href("/terms")}>{tr("Terms")}</a>
          <span>•</span>
          <a className="hover:text-white/70" href={href("/delete-account")}>{tr("Delete account")}</a>
        </div>
      </div>
    </main>
  );
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  useLocale();
  const desktopApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const deleteHref = desktopApp ? "#/delete-account" : "/delete-account";
  if (kind === "delete") {
    return (
      <LegalShell
        title={tr("Delete your Ceventic account")}
        intro={tr("Ceventic lets you permanently delete your account and associated tracker data.")}
      >
        <Section title={tr("Delete directly in the app")}>
          <p>{tr("Sign in to Ceventic, open")} <strong className="font-semibold text-white/78">{tr("Settings → Account")}</strong>{tr(", choose")} <strong className="font-semibold text-white/78">{tr("Delete account & data")}</strong>{tr(", and complete the confirmation. The deletion is permanent.")}</p>
          <p>{tr("The in-app deletion removes your Ceventic profile and authentication links together with routines, tasks, habits, workouts, progress, Athkar data, macro inputs, trusted-device records, preferences, and other account-owned tracker data stored by Ceventic.")}</p>
        </Section>
        <Section title={tr("If you cannot access your account")}>
          <p>{tr("Email")} <a className="text-white/78 underline underline-offset-4" href={`mailto:${SUPPORT_EMAIL}?subject=Ceventic%20account%20deletion%20request`}>{SUPPORT_EMAIL}</a> {tr("from the email address connected to your Ceventic account and use the subject")} <strong className="font-semibold text-white/78">{tr("Ceventic account deletion request")}</strong>.</p>
          <p>{tr("We may ask for reasonable information needed to verify that the request belongs to the account owner before deleting data.")}</p>
        </Section>
        <Section title={tr("What may remain temporarily")}>
          <p>{tr("Short-lived infrastructure, security, anti-abuse, or backup records may persist for a limited period where technically necessary to protect the service, investigate abuse, or complete backup rotation. They are not kept for normal product use after deletion.")}</p>
        </Section>
        <Section title={tr("Google account")}>
          <p>{tr("Deleting Ceventic removes the Ceventic account and its Google sign-in link from Ceventic. It does not delete your Google account.")}</p>
        </Section>
      </LegalShell>
    );
  }

  if (kind === "terms") {
    return (
      <LegalShell title={tr("Terms of Service")} intro={tr("These terms govern your use of the Ceventic System beta application and related services.")}>
        <Section title={tr("1. Beta service")}>
          <p>{tr("Ceventic is currently offered as a beta product. Features may change, be improved, or occasionally be unavailable while the service is being developed.")}</p>
        </Section>
        <Section title={tr("2. Your account")}>
          <p>{tr("You are responsible for keeping your sign-in credentials secure and for activity performed through your account. Do not attempt to access another user's account or bypass Ceventic's security controls.")}</p>
        </Section>
        <Section title={tr("3. Your content")}>
          <p>{tr("You keep ownership of the routines, habits, workouts, notes, Athkar customizations, nutrition inputs, and other content you enter. You give Ceventic permission to process that content only as needed to provide and operate the service.")}</p>
        </Section>
        <Section title={tr("4. Acceptable use")}>
          <p>{tr("Do not abuse the service, interfere with its operation, probe or attack its infrastructure, automate excessive requests, distribute malware, or use Ceventic in a way that violates applicable law.")}</p>
        </Section>
        <Section title={tr("5. Health and fitness information")}>
          <p>{tr("Ceventic can help you organize workouts, habits, nutrition targets, and personal progress. It is not medical advice, diagnosis, or treatment. You remain responsible for decisions about your health, training, and nutrition.")}</p>
        </Section>
        <Section title={tr("6. Availability and changes")}>
          <p>{tr("Because this is a beta, we do not promise uninterrupted availability or that every feature will remain unchanged. We may modify or discontinue beta features when necessary for security, reliability, or product development.")}</p>
        </Section>
        <Section title={tr("7. No paid subscription yet")}>
          <p>{tr("The current public beta is free. If paid plans are introduced later, pricing and any additional terms will be presented before a user is charged.")}</p>
        </Section>
        <Section title={tr("8. Termination and deletion")}>
          <p>{tr("We may restrict access when an account is used to abuse the service or compromise other users or Ceventic's systems. You may stop using Ceventic at any time and may permanently delete your account through the in-app account settings.")}</p>
        </Section>
        <Section title={tr("9. Changes to these terms")}>
          <p>{tr("These terms may be updated as the beta evolves. The date at the top of this page shows the latest revision.")}</p>
        </Section>
      </LegalShell>
    );
  }

  return (
    <LegalShell title={tr("Privacy Policy")} intro={tr("This policy explains what Ceventic processes during the beta, why it is needed, and the choices available to users.")}>
      <Section title={tr("1. Information Ceventic processes")}>
        <p><strong className="font-semibold text-white/78">{tr("Account information:")}</strong> {tr("your email address, display name, authentication provider information, and internal account identifiers.")}</p>
        <p><strong className="font-semibold text-white/78">{tr("Content you enter:")}</strong> {tr("routines and tasks, habits, workouts and exercise notes, progress records, Athkar progress/custom entries, and nutrition or macro-calculator inputs.")}</p>
        <p><strong className="font-semibold text-white/78">{tr("Security information:")}</strong> {tr("session/authentication records, hashed trusted-device tokens, device labels, verification state, and bounded rate-limit counters used to protect the service.")}</p>
        <p><strong className="font-semibold text-white/78">{tr("Technical information:")}</strong> {tr("hosting and infrastructure providers may process standard request, device, network, and diagnostic information needed to deliver and secure the service.")}</p>
      </Section>
      <Section title={tr("2. How information is used")}>
        <p>{tr("We use this information to authenticate you, save and synchronize your personal system, calculate progress/statistics, provide the features you request, prevent abuse, troubleshoot failures, and maintain service security and reliability.")}</p>
      </Section>
      <Section title={tr("3. Google sign-in")}>
        <p>{tr("If you choose Google sign-in, Ceventic uses the basic identity information required to sign you in, such as your Google account identifier, email address, and profile information supplied by the authentication flow. Ceventic does not request access to your Gmail, Google Drive, contacts, or calendar for this sign-in feature.")}</p>
      </Section>
      <Section title={tr("4. Service providers")}>
        <p>{tr("Ceventic relies on Convex for backend, database, and authentication services; Vercel for the web release and public pages; and Google when you choose Google OAuth. Those providers process information according to their own terms and privacy practices while providing their services to Ceventic.")}</p>
      </Section>
      <Section title={tr("5. Selling data and advertising")}>
        <p>{tr("Ceventic does not sell your personal information. The current beta does not use your personal tracker data for third-party advertising.")}</p>
      </Section>
      <Section title={tr("6. Data security")}>
        <p>{tr("We use authenticated backend access checks, per-user ownership validation, input limits, rate limits, restrictive web/desktop security policies, and encrypted HTTPS connections. No online service can guarantee absolute security.")}</p>
      </Section>
      <Section title={tr("7. Retention and deletion")}>
        <p>{tr("Your account and tracker data are retained while needed to provide Ceventic. You can permanently delete your account from")} <strong className="font-semibold text-white/78">{tr("Settings → Account")}</strong>{tr(". Ceventic then removes the account and its account-owned tracker data from the live application database.")}</p>
        <p>{tr("If you cannot sign in, use the public")} <a className="text-white/78 underline underline-offset-4" href={deleteHref}>{tr("account deletion page")}</a> {tr("to request deletion. Limited security, anti-abuse, infrastructure, or backup records may remain temporarily where technically or legally necessary.")}</p>
      </Section>
      <Section title={tr("8. Email verification during beta")}>
        <p>{tr("The initial free beta may allow password accounts without email verification while Ceventic's transactional email system is not enabled. Google sign-in relies on Google's identity flow. Additional email verification and recovery controls may be introduced as the service develops.")}</p>
      </Section>
      <Section title={tr("9. Children")}>
        <p>{tr("Ceventic is not designed as a service directed specifically to children. Users must meet any age requirements that apply to them under their local law and app-store account rules.")}</p>
      </Section>
      <Section title={tr("10. Changes to this policy")}>
        <p>{tr("We may update this policy as Ceventic adds features, providers, or paid plans. The latest revision date is shown at the top of this page.")}</p>
      </Section>
    </LegalShell>
  );
}
