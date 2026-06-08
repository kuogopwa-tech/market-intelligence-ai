import { useEffect, useMemo, useState } from "react";

type AnimatedCounterProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

export default function AnimatedCounter({
  value,
  decimals = 0,
  suffix = "",
  durationMs = 650,
  className = "",
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = display;
    const diff = value - from;

    const tick = (t: number) => {
      const p = Math.min((t - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + diff * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  const formatted = useMemo(() => `${display.toFixed(decimals)}${suffix}`, [display, decimals, suffix]);

  return <span className={`font-mono animate-number-pop ${className}`}>{formatted}</span>;
}
