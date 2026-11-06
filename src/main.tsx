import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

class Guard extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || "알 수 없는 오류" };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="kalos-sky grid min-h-dvh place-items-center p-6 text-cream">
        <div className="max-w-md rounded-2xl border border-gold/40 bg-ink/85 p-6">
          <h1 className="font-display text-2xl text-gold">화면이 멈추었다</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{this.state.error}</p>
          <button
            type="button"
            className="mt-4 h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-ink"
            onClick={() => {
              localStorage.removeItem("kalos-empire-v1");
              localStorage.removeItem("kalos-league-v1");
              location.reload();
            }}
          >
            기록을 지우고 다시 열기
          </button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Guard>
      <App />
    </Guard>
  </StrictMode>,
);
