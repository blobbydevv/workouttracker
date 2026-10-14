import { Component, type ReactNode } from "react";

/** Shows what went wrong instead of a blank page, with a way to recover. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <Fatal message={this.state.error.message} />;
  }
}

export function Fatal({ message }: { message: string }) {
  return (
    <div className="screen" style={{ paddingTop: 48 }}>
      <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
      <div className="notice error" role="alert" style={{ wordBreak: "break-word" }}>{message}</div>
      <p className="muted">Your data is stored on this device and hasn't been deleted.</p>
      <button className="btn block" onClick={() => location.assign(import.meta.env.BASE_URL)}>Reload app</button>
    </div>
  );
}
