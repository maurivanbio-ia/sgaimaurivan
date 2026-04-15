import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[EcoGestor] Render error:", error, info.componentStack);
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            fontFamily: "sans-serif",
            background: "#f8fafc",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
            Algo deu errado nesta página
          </h2>
          <p style={{ color: "#64748b", marginBottom: 24, maxWidth: 420 }}>
            Ocorreu um erro inesperado. Tente recarregar a página ou navegue para outra seção.
          </p>
          {this.state.error && (
            <pre
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 12,
                color: "#dc2626",
                maxWidth: 500,
                overflowX: "auto",
                marginBottom: 24,
                textAlign: "left",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => this.handleReload()}
              style={{
                background: "#0369a1",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Recarregar página
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                background: "#fff",
                color: "#0369a1",
                border: "1px solid #bae6fd",
                borderRadius: 8,
                padding: "10px 24px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Ir para o início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
