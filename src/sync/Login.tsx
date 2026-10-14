import { useState } from "react";
import { useOnline } from "../components/ui";
import { supabase } from "./supabase";

type Mode = "signin" | "signup" | "reset" | "newPassword";

export default function Login({ mode: initial, onDone }: { mode: Mode; onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const online = useOnline();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!online) return setError("You're offline. Connect to the internet to sign in.");
    if (mode !== "newPassword" && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if ((mode === "signup" || mode === "newPassword") && password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    const auth = supabase().auth;
    try {
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL } });
        if (error) throw error;
        if (!data.session) setInfo("Check your email to confirm your account, then sign in.");
      } else if (mode === "reset") {
        const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + import.meta.env.BASE_URL });
        if (error) throw error;
        setInfo("If that email has an account, a reset link is on its way.");
      } else {
        const { error } = await auth.updateUser({ password });
        if (error) throw error;
        onDone?.();
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  const title = { signin: "Sign in", signup: "Create account", reset: "Reset password", newPassword: "Choose a new password" }[mode];

  return (
    <div className="screen" style={{ paddingTop: 56, maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>{title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {mode === "signin" && "Sign in to see your workouts and food logs on all your devices."}
        {mode === "signup" && "One account keeps your phone and computer in sync."}
        {mode === "reset" && "We'll email you a link to set a new password."}
        {mode === "newPassword" && "Enter a new password for your account."}
      </p>
      <form onSubmit={submit} noValidate>
        {mode !== "newPassword" && (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {mode !== "reset" && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {error && <div className="notice error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
        {info && <div className="notice" role="status" style={{ marginBottom: 12 }}>{info}</div>}
        <button className="btn block" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : title}</button>
      </form>
      {mode === "signin" && (
        <>
          <button className="btn block ghost" style={{ marginTop: 8 }} onClick={() => { setMode("signup"); setError(null); }}>New here? Create an account</button>
          <button className="btn block ghost" onClick={() => { setMode("reset"); setError(null); }}>Forgot password?</button>
        </>
      )}
      {(mode === "signup" || mode === "reset") && (
        <button className="btn block ghost" style={{ marginTop: 8 }} onClick={() => { setMode("signin"); setError(null); setInfo(null); }}>Already have an account? Sign in</button>
      )}
    </div>
  );
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/already registered|already been registered/i.test(msg)) return "That email already has an account. Sign in instead.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Wait a few minutes and try again.";
  if (/failed to fetch|network/i.test(msg)) return "Couldn't reach the server. Check your connection.";
  return msg;
}
