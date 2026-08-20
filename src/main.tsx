import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const forceBlackMobileChrome = () => {
  document.documentElement.style.backgroundColor = "#000000";
  document.body.style.backgroundColor = "#000000";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = "#000000";
  });
};

forceBlackMobileChrome();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) forceBlackMobileChrome();
});

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <App />
  </ConvexAuthProvider>,
);
