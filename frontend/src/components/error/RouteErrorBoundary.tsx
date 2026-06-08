import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export default class RouteErrorBoundary extends React.Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unexpected route error",
    };
  }

  public componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // Keep minimal; no external logging dependency added
    // eslint-disable-next-line no-console
    console.error("RouteErrorBoundary", { error, info });
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm">{this.state.message ?? "Route rendering failed."}</p>
        </div>
      );
    }

    return this.props.children;
  }
}