import { Link, NavLink, Outlet } from "react-router-dom";
import { BarChart3, Brain, Gauge, History, Home, LineChart, Menu, Settings, Sparkles } from "lucide-react";
import { useState } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/market-intelligence", label: "Market Intelligence", icon: Brain },
  { to: "/ai-predictions", label: "AI Predictions", icon: Sparkles },
  { to: "/symbol-analysis", label: "Symbol Analysis", icon: LineChart },
  { to: "/memory-history", label: "Memory / History", icon: History },
  { to: "/intelligence-hub", label: "Intelligence Hub", icon: Gauge },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="flex">
        <aside className={`fixed z-30 h-screen w-72 border-r border-white/10 bg-slate-900/80 p-4 backdrop-blur-xl transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <Link to="/dashboard" className="mb-6 block text-xl font-semibold text-cyan-300">Deriv AI Pro</Link>
          <nav className="space-y-1">
            {nav.map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${isActive ? "bg-cyan-500/20 text-cyan-200" : "text-slate-300 hover:bg-white/5"}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={16} /> {n.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="w-full md:ml-72">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <button className="rounded-lg border border-white/10 p-2 md:hidden" onClick={() => setOpen((v) => !v)}>
                <Menu size={18} />
              </button>
              <div className="text-sm text-slate-300">Premium Intelligence Dashboard</div>
              <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">Live</div>
            </div>
          </header>
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
