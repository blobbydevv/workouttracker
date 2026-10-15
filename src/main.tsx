import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { ErrorBoundary, Fatal } from "./components/ErrorBoundary";
import { ensureSeeded } from "./domain/onboarding";
import { applyTheme } from "./screens/Profile";
import { installHistoryGuard } from "./lib/historyGuard";
import "./sync"; // installs change tracking before anything writes to the database
import { AccountGate } from "./sync/AccountGate";
import { UpdateBanner } from "./components/UpdateBanner";

installHistoryGuard();

try {
  const t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") applyTheme(t);
} catch {
  /* storage blocked: follow system appearance */
}

const root = createRoot(document.getElementById("root")!);

ensureSeeded()
  .then(() =>
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <UpdateBanner />
          <AccountGate>
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <App />
            </BrowserRouter>
          </AccountGate>
        </ErrorBoundary>
      </StrictMode>,
    ),
  )
  .catch((e: unknown) => {
    // Usually IndexedDB being unavailable (some private-browsing modes) or blocked storage.
    const msg = e instanceof Error ? e.message : String(e);
    root.render(<Fatal message={`This browser couldn't open on-device storage, which the app needs to save your data. ${msg}`} />);
  });

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    /* offline shell unavailable; app still works online */
  });
}
