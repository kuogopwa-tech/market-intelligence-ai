import type { PropsWithChildren } from "react";

type GlowingCardProps = PropsWithChildren<{
  className?: string;
  active?: boolean;
}>;

export default function GlowingCard({ children, className = "", active = false }: GlowingCardProps) {
  return (
    <div className={`glowing-card rounded-2xl p-4 ${active ? "signal-active shadow-glow" : ""} ${className}`}>
      {children}
    </div>
  );
}
