import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useGetSignalQuality, getGetSignalQualityQueryKey } from "@workspace/api-client-react";
import { useAppStore, AlertFeedEntry, AlertLevel } from "../store";

const POLL_INTERVAL_MS = 15_000;
const ALERT_COOLDOWN_MS = 4 * 60 * 1000; // 4 min cooldown per symbol+alertType

interface AlertConfig {
  label: string;
  level: AlertLevel;
  emoji: string;
  toastType: "success" | "error" | "warning" | "info";
  minQuality: number;
}

const ALERT_CONFIGS: Record<string, AlertConfig> = {
  "High Confidence Bullish": {
    label: "High Confidence Bullish",
    level: "bullish",
    emoji: "🟢",
    toastType: "success",
    minQuality: 65,
  },
  "High Confidence Bearish": {
    label: "High Confidence Bearish",
    level: "bearish",
    emoji: "🔴",
    toastType: "error",
    minQuality: 65,
  },
  "Reversal Watch": {
    label: "Reversal Watch",
    level: "reversal",
    emoji: "🔄",
    toastType: "warning",
    minQuality: 0,
  },
  "Spike Risk Warning": {
    label: "Spike Risk Warning",
    level: "spike",
    emoji: "⚡",
    toastType: "warning",
    minQuality: 0,
  },
  "No-Trade Warning": {
    label: "No-Trade Warning",
    level: "noTrade",
    emoji: "🛑",
    toastType: "warning",
    minQuality: 0,
  },
};

function alertFingerprint(symbol: string, alertType: string, bucket: number) {
  return `${symbol}:${alertType}:${bucket}`;
}

export function useSignalAlert() {
  const { selectedSymbol, granularity, addAlert } = useAppStore();
  const prevAlertType = useRef<string>("none");
  const prevConfidence = useRef<number>(0);
  const alerted = useRef<Map<string, number>>(new Map());

  const intervalValue = granularity || "60";
  const isTickInterval = intervalValue.endsWith('t');
  const numericGranularity = isTickInterval ? 60 : parseInt(intervalValue, 10);

  const { data: quality } = useGetSignalQuality(
    { symbol: selectedSymbol, granularity: numericGranularity },
    {
      query: {
        queryKey: getGetSignalQualityQueryKey({ symbol: selectedSymbol, granularity: numericGranularity }),
        refetchInterval: POLL_INTERVAL_MS,
        enabled: !!selectedSymbol,
      },
    }
  );

  useEffect(() => {
    if (!quality) return;

    const { alertType, cleanSignalScore, confidenceWeight, marketState, riskLevel,
      supportingSignals, setupRarity, expirySeconds, bullishScore, bearishScore } = quality;

    if (alertType === "none") {
      prevAlertType.current = "none";
      return;
    }

    const config = ALERT_CONFIGS[alertType];
    if (!config) return;

    // Quality gate for high-confidence alerts
    if (
      (alertType === "High Confidence Bullish" || alertType === "High Confidence Bearish") &&
      cleanSignalScore < config.minQuality
    ) {
      return;
    }

    // State-change detection — only fire if the alert type changed meaningfully
    // OR confidence improved significantly (>8 points)
    const alertTypeChanged = prevAlertType.current !== alertType;
    const confidenceJump = confidenceWeight - prevConfidence.current > 8;
    const shouldFire = alertTypeChanged || confidenceJump;

    if (!shouldFire) return;

    // Cooldown check — 4-minute bucket
    const bucket = Math.floor(Date.now() / ALERT_COOLDOWN_MS);
    const fp = alertFingerprint(selectedSymbol, alertType, bucket);
    if (alerted.current.has(fp)) return;
    alerted.current.set(fp, Date.now());

    prevAlertType.current = alertType;
    prevConfidence.current = confidenceWeight;

    const topSignal = supportingSignals[0] ?? "";

    // Build alert feed entry
    const entry: AlertFeedEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      alertType,
      level: config.level,
      symbol: selectedSymbol,
      confidence: confidenceWeight,
      cleanSignalScore,
      marketState,
      riskLevel,
      topSignal,
      setupRarity,
      expiresAt: Date.now() + expirySeconds * 1000,
    };

    addAlert(entry);

    // Fire toast with full context
    const scoreLabel = `Quality ${cleanSignalScore}/100`;
    const rarityLabel = setupRarity !== "common" ? ` · ${setupRarity.charAt(0).toUpperCase() + setupRarity.slice(1)} setup` : "";

    const description = [
      `${marketState}  ·  ${scoreLabel}${rarityLabel}`,
      `Confidence ${confidenceWeight}%  ·  ${alertType.includes("Bullish") ? `Bull ${bullishScore}` : alertType.includes("Bearish") ? `Bear ${bearishScore}` : ""}`,
      topSignal ? `↳ ${topSignal}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const toastFn = config.toastType === "success" ? toast.success
      : config.toastType === "error" ? toast.error
      : toast.warning;

    toastFn(`${config.emoji} ${config.label} — ${selectedSymbol}`, {
      description,
      duration: 12_000,
      action: {
        label: "View Analysis",
        onClick: () => {
          window.location.href = `${import.meta.env.BASE_URL}analysis`.replace("//", "/");
        },
      },
    });
  }, [quality, selectedSymbol, addAlert]);
}
