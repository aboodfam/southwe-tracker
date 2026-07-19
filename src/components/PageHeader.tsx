import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const glow = useMemo(() => {
    // a soft glow that works across themes
    return `radial-gradient(circle, ${colors.primary}22, transparent 60%)`;
  }, [colors.primary]);

  return (
    <div className="text-center pt-2 sm:pt-4 animate-float-in">
      <div className="relative inline-block">
        <h1
          className="text-4xl sm:text-5xl font-extrabold tracking-tight"
          style={{ color: colors.primary }}
        >
          {title}
        </h1>

        <div
          className="absolute -inset-6 blur-2xl opacity-60 pointer-events-none"
          style={{ background: glow }}
        />
      </div>

      <p className="mt-3 text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.65)" }}>
        {subtitle}
      </p>

      <div className="mt-4 flex justify-center">
        <div
          className="h-[3px] w-28 rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
            boxShadow: `0 0 18px ${colors.primary}25`,
          }}
        />
      </div>
    </div>
  );
}
