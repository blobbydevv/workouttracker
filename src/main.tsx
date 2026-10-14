import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { ensureSeeded } from "./domain/onboarding";
import { applyTheme } from "./screens/Profile";

try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") applyTheme(t);
} catch {
  /* storage blocked: follow system appearance */
}

ensureSeeded().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* offline shell unavailable; app still works online */
  });
}
