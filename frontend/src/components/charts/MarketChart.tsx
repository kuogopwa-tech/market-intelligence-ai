import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Candle } from "@/api/types";

export default function MarketChart({ data }: { data: Candle[] }) {
  const points = data.map((d) => ({ time: d.epoch, close: d.close }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={points}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={false} />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Area type="monotone" dataKey="close" stroke="#22d3ee" fill="url(#fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
