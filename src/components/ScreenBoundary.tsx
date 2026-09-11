import { Component, type ReactNode } from "react";
import { useConvexConnectionState } from "convex/react";

export function ConnectionNotice() {
  const connection = useConvexConnectionState();
  return connection.isWebSocketConnected ? null : <div role="status" className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-3 text-center text-sm text-amber-100">Reconnecting. Saved information may be out of date; wait for the connection before editing.</div>;
}

export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="mx-auto max-w-xl rounded-3xl border border-white/15 bg-black/40 p-6 text-center">
      <h2 className="text-xl font-bold">This screen couldn't load</h2><p className="mt-3 text-sm leading-6 text-white/65">Your saved data hasn't been removed. Check your connection and try again, or open another section. If this started after an update, make sure the app and server updates were both installed.</p>
      <button onClick={() => this.setState({ failed: false })} className="mt-5 min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold">Try again</button>
    </section>;
  }
}
