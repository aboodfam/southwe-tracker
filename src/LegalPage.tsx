import type { ReactNode } from "react";

type LegalKind = "privacy" | "terms";

const UPDATED = "August 20, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-white/62 sm:text-[15px]">{children}</div>
    </section>
  );
}

function LegalShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim();
  const desktopApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  const homeHref = desktopApp ? "#/" : "/";
  const privacyHref = desktopApp ? "#/privacy" : "/privacy";
  const termsHref = desktopApp ? "#/terms" : "/terms";
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <a href={homeHref} className="inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white">
          <span aria-hidden="true">←</span> Back to Ceventic
        </a>

        <div className="mt-7 rounded-[28px] border border-white/10 bg-white/[0.025] p-5 shadow-2xl sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-white/35">Ceventic System</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/52 sm:text-[15px]">{intro}</p>
          <div className="mt-4 text-xs text-white/30">Last updated: {UPDATED}</div>

          <div className="mt-8 space-y-8 border-t border-white/8 pt-8">{children}</div>

          <div className="mt-9 border-t border-white/8 pt-6 text-sm leading-6 text-white/40">
            {supportEmail ? (
              <p>
                Questions or privacy requests: <a className="text-white/70 underline underline-offset-4" href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </p>
            ) : (
              <p>Questions or privacy requests can be submitted through the support contact published with Ceventic's official release/store listing.</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-white/35">
          <a className="hover:text-white/70" href={privacyHref}>Privacy</a>
          <span>•</span>
          <a className="hover:text-white/70" href={termsHref}>Terms</a>
        </div>
      </div>
    </main>
  );
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  if (kind === "terms") {
    return (
      <LegalShell title="Terms of Service" intro="These terms govern your use of the Ceventic System beta application and related services.">
        <Section title="1. Beta service">
          <p>Ceventic is currently offered as a beta product. Features may change, be improved, or occasionally be unavailable while the service is being developed.</p>
        </Section>
        <Section title="2. Your account">
          <p>You are responsible for keeping your sign-in credentials secure and for activity performed through your account. Do not attempt to access another user's account or bypass Ceventic's security controls.</p>
        </Section>
        <Section title="3. Your content">
          <p>You keep ownership of the routines, habits, workouts, notes, Athkar customizations, nutrition inputs, and other content you enter. You give Ceventic permission to process that content only as needed to provide and operate the service.</p>
        </Section>
        <Section title="4. Acceptable use">
          <p>Do not abuse the service, interfere with its operation, probe or attack its infrastructure, automate excessive requests, distribute malware, or use Ceventic in a way that violates applicable law.</p>
        </Section>
        <Section title="5. Health and fitness information">
          <p>Ceventic can help you organize workouts, habits, nutrition targets, and personal progress. It is not medical advice, diagnosis, or treatment. You remain responsible for decisions about your health, training, and nutrition.</p>
        </Section>
        <Section title="6. Availability and changes">
          <p>Because this is a beta, we do not promise uninterrupted availability or that every feature will remain unchanged. We may modify or discontinue beta features when necessary for security, reliability, or product development.</p>
        </Section>
        <Section title="7. No paid subscription yet">
          <p>The current public beta is free. If paid plans are introduced later, pricing and any additional terms will be presented before a user is charged.</p>
        </Section>
        <Section title="8. Termination">
          <p>We may restrict access when an account is used to abuse the service or compromise other users or Ceventic's systems. Users may stop using Ceventic at any time.</p>
        </Section>
        <Section title="9. Changes to these terms">
          <p>These terms may be updated as the beta evolves. The date at the top of this page shows the latest revision.</p>
        </Section>
      </LegalShell>
    );
  }

  return (
    <LegalShell title="Privacy Policy" intro="This policy explains what Ceventic processes during the beta, why it is needed, and the choices available to users.">
      <Section title="1. Information Ceventic processes">
        <p><strong className="font-semibold text-white/78">Account information:</strong> your email address, display name, authentication provider information, and internal account identifiers.</p>
        <p><strong className="font-semibold text-white/78">Content you enter:</strong> routines and tasks, habits, workouts and exercise notes, progress records, Athkar progress/custom entries, and nutrition or macro-calculator inputs.</p>
        <p><strong className="font-semibold text-white/78">Security information:</strong> session/authentication records, hashed trusted-device tokens, device labels, verification state, and bounded rate-limit counters used to protect the service.</p>
        <p><strong className="font-semibold text-white/78">Technical information:</strong> hosting and infrastructure providers may process standard request, device, network, and diagnostic information needed to deliver and secure the service.</p>
      </Section>
      <Section title="2. How information is used">
        <p>We use this information to authenticate you, save and synchronize your personal system, calculate progress/statistics, provide the features you request, prevent abuse, troubleshoot failures, and maintain service security and reliability.</p>
      </Section>
      <Section title="3. Google sign-in">
        <p>If you choose Google sign-in, Ceventic uses the basic identity information required to sign you in, such as your Google account identifier, email address, and profile information supplied by the authentication flow. Ceventic does not request access to your Gmail, Google Drive, contacts, or calendar for this sign-in feature.</p>
      </Section>
      <Section title="4. Service providers">
        <p>Ceventic relies on infrastructure providers such as Convex for backend/database/authentication services, Vercel for the web release and public pages, and Google when you choose Google OAuth. Those providers process information according to their own terms and privacy practices while providing their services to Ceventic.</p>
      </Section>
      <Section title="5. Selling data and advertising">
        <p>Ceventic does not sell your personal information. The current beta does not use your personal tracker data for third-party advertising.</p>
      </Section>
      <Section title="6. Data security">
        <p>We use authenticated backend access checks, per-user ownership validation, input limits, rate limits, restrictive web/desktop security policies, and encrypted HTTPS connections. No online service can guarantee absolute security.</p>
      </Section>
      <Section title="7. Retention and deletion">
        <p>Account and tracker data are retained while needed to provide your Ceventic account and beta service. Before the Google Play public release, Ceventic will provide a readily discoverable in-app account-deletion control and an external deletion-request route as required for apps that create accounts.</p>
      </Section>
      <Section title="8. Children">
        <p>Ceventic is not designed as a service directed specifically to children. Users must meet any age requirements that apply to them under their local law and app-store account rules.</p>
      </Section>
      <Section title="9. Changes to this policy">
        <p>We may update this policy as Ceventic adds features, providers, or paid plans. The latest revision date is shown at the top of this page.</p>
      </Section>
    </LegalShell>
  );
}
