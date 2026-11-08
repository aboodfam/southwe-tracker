import { rememberAndroidPairing } from "./lib/androidBridge";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App";

rememberAndroidPairing();

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const syncMobileChrome = () => {
  const surface = getComputedStyle(document.documentElement)
    .getPropertyValue("--sw-surface-rgb")
    .trim()
    .split(/\s+/)
    .map(Number);
  const color =
    surface.length === 3 &&
    surface.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 255,
    )
      ? `rgb(${surface.join(", ")})`
      : "rgb(9, 13, 18)";
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.content = color;
    });
};

syncMobileChrome();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncMobileChrome();
});

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>,
);
