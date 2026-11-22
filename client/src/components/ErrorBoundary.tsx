import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: unknown;
}

/** Whatever was thrown, as readable text (not everything thrown is an Error with a stack). */
function describe(error: unknown): string {
  if (error instanceof Error) return error.stack || `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    // `null` would read as "no error": keep a marker for odd throws.
    return { error: error ?? new Error("Erreur inconnue") };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.error === null) return this.props.children;

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Une erreur est survenue</h1>
            <p className="text-muted-foreground">
              La page n'a pas pu s'afficher. Recharger suffit souvent, surtout après une mise à jour du site.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            {/* A new deploy (or the dev server re-bundling) leaves old tabs with stale code: a reload fixes it. */}
            <Button className="w-full" onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => (window.location.href = "/")}>
              Retour à l'accueil
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="mt-8 max-h-64 overflow-auto rounded-lg border border-border bg-secondary p-4 text-left text-xs">
              {describe(this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
