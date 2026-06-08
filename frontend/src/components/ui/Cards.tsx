import { PropsWithChildren } from "react";

export function GlassCard({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <div className={`glass rounded-2xl p-4 ${className}`}>{children}</div>;
}

export function MetricCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <GlassCard>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value mt-2">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </GlassCard>
  );
}
