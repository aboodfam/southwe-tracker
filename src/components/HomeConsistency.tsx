import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { t as tr, useLocale, getIntlLocale } from "../i18n";
import { hasHomeActivity } from "../lib/homeOverview";
import { Icon } from "./icons";

export function HomeConsistency({
  dateKey,
  hiddenPages,
  onOpen,
}: {
  dateKey: string;
  hiddenPages: string[];
  onOpen: () => void;
}) {
  useLocale();
  const week = useQuery(api.progress.getProgressData, {
    dateKey,
    timeFrame: "daily",
  });
  const active =
    week?.filter((day) => hasHomeActivity(day, hiddenPages)).length ?? 0;
  return (
    <section
      aria-label={tr("Weekly consistency")}
      className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Icon name="chart" className="h-4 w-4 text-primary" />
          {tr("Weekly consistency")}
        </h2>
        {!hiddenPages.includes("progress") && (
          <button onClick={onOpen} className="min-h-11 text-sm text-primary">
            {tr("Progress")}
          </button>
        )}
      </div>
      {week === undefined ? (
        <p role="status" className="py-3 text-sm text-white/50">
          {tr("Gathering your progress…")}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-white/70">
            {tr("{0} of 7 days with activity", { 0: active })}
          </p>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {week.map((day) => {
              const logged = hasHomeActivity(day, hiddenPages);
              const label = new Date(
                day.date + "T12:00:00Z",
              ).toLocaleDateString(getIntlLocale(), {
                weekday: "short",
                timeZone: "UTC",
              });
              return (
                <div
                  key={day.date}
                  aria-label={`${label}: ${logged ? tr("Activity recorded") : tr("No activity recorded")}`}
                  className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border px-1 py-3 text-center ${logged ? "border-primary/30 bg-primary/10" : day.date === dateKey ? "border-white/20 bg-white/[0.04]" : "border-white/5"}`}
                >
                  <span className="max-w-full truncate text-[10px] text-white/55">
                    {label}
                  </span>
                  <span className={logged ? "text-primary" : "text-white/25"}>
                    {logged ? <Icon name="check" className="h-4 w-4" /> : "·"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-white/45">
            {tr(
              "Last 7 days of task, habit and workout activity. Unrecorded days are not failures.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
