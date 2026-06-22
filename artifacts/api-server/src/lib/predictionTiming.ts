export const PREDICTION_WINDOW_SECONDS =
  process.env.PREDICTION_WINDOW_SECONDS
    ? Math.max(1, parseInt(process.env.PREDICTION_WINDOW_SECONDS, 10))
    : 30;

export function secondsRemainingFromResolveAt(
  resolveAtSeconds: number,
  nowMs: number = Date.now()
): number {
  const remainingMs = resolveAtSeconds * 1000 - nowMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function isResolved(nowSeconds: number, resolveAtSeconds: number): boolean {
  return nowSeconds >= resolveAtSeconds;
}

export function resolveStatus(
  nowSeconds: number,
  resolveAtSeconds: number,
  outcome?: "correct" | "incorrect" | null
): { status: "pending" | "correct" | "incorrect"; secondsRemaining: number } {
  if (!isResolved(nowSeconds, resolveAtSeconds)) {
    return {
      status: "pending",
      secondsRemaining: secondsRemainingFromResolveAt(resolveAtSeconds, nowSeconds * 1000),
    };
  }

  if (outcome === "correct") {
    return { status: "correct", secondsRemaining: 0 };
  }
  if (outcome === "incorrect") {
    return { status: "incorrect", secondsRemaining: 0 };
  }

  // If resolved but outcome missing, keep pending-style status in helper.
  return { status: "pending", secondsRemaining: 0 };
}
