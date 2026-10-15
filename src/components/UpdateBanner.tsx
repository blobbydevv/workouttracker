import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 60_000;

/** Polls the published version.json and offers a reload when a newer build is live. */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== __BUILD_ID__) setAvailable(true);
      } catch {
        /* offline or blocked: try again later */
      }
    };
    void check();
    const iv = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, []);
  if (!available) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version is available.</span>
      <button className="btn small" onClick={() => location.reload()}>Update</button>
    </div>
  );
}
