// Rest-timer completion alert. Web platform limits: no background execution
// once the tab is suspended, and no Live Activities / Watch. We persist the
// end time so the timer is correct on return, and fire a Notification if the
// user granted permission and the page is hidden.
let ctx: AudioContext | null = null;

export function beep() {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.42);
  } catch {
    /* audio unavailable */
  }
}

export function restDoneAlert() {
  beep();
  navigator.vibrate?.([200, 100, 200]);
  if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden") {
    new Notification("Rest complete", { body: "Time for your next set." });
  }
}

export async function requestNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

export const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
