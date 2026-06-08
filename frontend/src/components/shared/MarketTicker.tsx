import type { ScannerResult } from "@/api/types";

type MarketTickerProps = {
  items: ScannerResult[];
};

export default function MarketTicker({ items }: MarketTickerProps) {
  const rows = items.slice(0, 10);
  const repeated = [...rows, ...rows];

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <div className="flex min-w-max animate-ticker-scroll gap-6 px-4 py-2 text-sm">
        {repeated.map((it, idx) => (
          <div key={`${it.symbol}-${idx}`} className="whitespace-nowrap">
            <span className="font-semibold text-brand-cyan">{it.symbol}</span>
            <span className="mx-2 text-text-500">•</span>
            <span className="text-text-300">Conf {Math.round(it.confidence)}%</span>
            <span className="mx-2 text-text-500">•</span>
            <span className={it.bullishScore >= it.bearishScore ? "text-emerald-400" : "text-rose-400"}>
              {it.bullishScore >= it.bearishScore ? "Bull" : "Bear"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
