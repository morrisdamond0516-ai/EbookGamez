import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "2rem",
            background: "hsl(30 15% 8%)",
            color: "hsl(35 30% 90%)",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "hsl(45 60% 50%)" }}>
            Something went wrong loading the page
          </h1>
          <p style={{ marginBottom: "1rem", opacity: 0.85 }}>
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.5rem 1rem",
              background: "hsl(45 60% 50%)",
              color: "hsl(30 15% 5%)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
          <p style={{ marginTop: "1.5rem", fontSize: "0.875rem", opacity: 0.6 }}>
            Local dev: make sure <code>npm run dev</code> is running, then open{" "}
            <a href="http://127.0.0.1:3000" style={{ color: "hsl(45 60% 60%)" }}>
              http://127.0.0.1:3000
            </a>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
