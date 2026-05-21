import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGetSignalAnalysis, getGetSignalAnalysisQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "../store";

const CONFIDENCE_THRESHOLD = 70;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per symbol
const POLL_INTERVAL_MS = 15_000;

function signalFingerprint(
  symbol: string,
  marketState: string,
  direction: "bull" | "bear",
  minuteBucket: number
) {
  return `${symbol}:${marketState}:${direction}:${minuteBucket}`;
}

export function useSignalAlert() {
  const { selectedSymbol, granularity } = useAppStore();

  // Track last-fired fingerprints per symbol to prevent repeat toasts
  const alerted = useRef<Map<string, number>>(new Map());

  const { data: signals } = useGetSignalAnalysis(
    { symbol: selectedSymbol, granularity },
    {
      query: {
        queryKey: getGetSignalAnalysisQueryKey({ symbol: selectedSymbol, granularity }),
        refetchInterval: POLL_INTERVAL_MS,
        enabled: !!selectedSymbol,
      },
    }
  );

  useEffect(() => {
    if (!signals) return;
    if (signals.noTradeZone) return;
    if (signals.confidence < CONFIDENCE_THRESHOLD) return;
    if (signals.conflictingSignals.length >= 2) return;

    const direction = signals.bullishScore > signals.bearishScore ? "bull" : "bear";
    const minuteBucket = Math.floor(Date.now() / (5 * 60_000)); // bucket every 5 min
    const fp = signalFingerprint(selectedSymbol, signals.marketState, direction, minuteBucket);

    const lastFired = alerted.current.get(fp) ?? 0;
    if (Date.now() - lastFired < ALERT_COOLDOWN_MS) return;

    alerted.current.set(fp, Date.now());

    const isBullish = direction === "bull";
    const topSignal = signals.supportingSignals[0] ?? "";
    const emoji = isBullish ? "🟢" : "🔴";
    const label = isBullish ? "Bullish" : "Bearish";
    const score = isBullish ? signals.bullishScore : signals.bearishScore;

    toast(
      `${emoji} ${label} Signal — ${selectedSymbol}`,
      {
        description: [
          `Market: ${signals.marketState}  •  Confidence: ${signals.confidence}%  •  Score: ${score}/100`,
          topSignal ? `↳ ${topSignal}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        duration: 10_000,
        action: {
          label: "View Analysis",
          onClick: () => {
            window.location.href = `${import.meta.env.BASE_URL}analysis`.replace("//", "/");
          },
        },
      }
    );
  }, [signals, selectedSymbol]);
}
