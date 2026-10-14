// Third-party scripts (e.g. Netlify's deploy/"Pre-launch tools" toolbar on
// private sites) wrap history.pushState/replaceState to track navigation. A
// buggy wrapper throws ("l is not a function"); React Router calls
// replaceState on startup, so the whole app crashed.
//
// This guard keeps every wrapper working, whether installed before or after
// us, but stops their errors from reaching the app. If a wrapper fails before
// the browser applied the navigation, we apply it with the native method.

type HistoryFn = (data: unknown, unused: string, url?: string | URL | null) => void;

function guard(method: "pushState" | "replaceState") {
  const native = History.prototype[method] as HistoryFn;
  const chain: HistoryFn[] = [history[method] as HistoryFn];
  let depth = 0;

  const wrapped: HistoryFn = function (this: History, ...args) {
    // Wrappers call "the original" they captured, which is this function
    // again: each re-entry moves one layer down the chain, ending at native.
    const fn = chain[chain.length - 1 - depth] ?? native;
    const outermost = depth === 0;
    const before = location.href;
    depth++;
    try {
      return fn.apply(this, args);
    } catch (err) {
      if (!outermost) throw err;
      console.warn(`Ignored an error thrown by a third-party history.${method} wrapper:`, err);
      const target = args[2] == null ? location.href : new URL(String(args[2]), location.href).href;
      const applied = method === "pushState" ? location.href !== before || target === before : false;
      if (!applied) native.apply(this, args);
    } finally {
      depth--;
    }
  };

  try {
    Object.defineProperty(history, method, {
      configurable: true,
      get: () => wrapped,
      set: (fn: unknown) => {
        if (typeof fn === "function" && fn !== wrapped) chain.push(fn as HistoryFn);
      },
    });
  } catch {
    /* property locked by another script: nothing more we can do */
  }
}

export function installHistoryGuard() {
  if (typeof history === "undefined") return;
  guard("pushState");
  guard("replaceState");
}
