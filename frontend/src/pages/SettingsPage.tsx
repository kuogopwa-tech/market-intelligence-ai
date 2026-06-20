import { useState } from "react";
import { GlassCard } from "@/components/ui/Cards";
import { useTheme, Theme } from "@/lib/theme-provider";
import { systemApi } from "@/api/services";
import { toast } from "sonner";

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "💻" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const [resetConfirm, setResetConfirm] = useState("");
  const [resetRunning, setResetRunning] = useState(false);
  const [resetResult, setResetResult] = useState<any | null>(null);

  const runFactoryReset = async () => {
    setResetRunning(true);
    setResetResult(null);
    try {
      // API requires { confirm: true } and optional { symbol }
      // Here we do a full reset (no symbol).
      const res = await systemApi.resetAll(undefined);

      setResetResult(res);
      toast.success("Factory reset completed");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Factory reset failed");
    } finally {
      setResetRunning(false);
    }
  };

  const canSubmit = !resetRunning && resetConfirm === "RESET";

  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mt-2 text-sm text-text-300">Backend URL: /api</p>
      </GlassCard>

      <GlassCard>
        <h3 className="text-md font-medium mb-3">Appearance</h3>
        <div className="flex gap-2">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                theme === t.value
                  ? "bg-brand-blue/20 text-brand-blue border border-brand-blue/50"
                  : "bg-bg-800 text-text-300 hover:bg-bg-800/80 border border-transparent"
              }`}
            >
              <span>{t.icon}</span>
              <span className="text-sm">{t.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="border border-rose-500/30 bg-rose-500/5">
        <h3 className="text-md font-medium mb-2">Factory Reset AI System</h3>
        <p className="text-sm text-slate-300 mb-4">
          This will delete all AI-learning tables (analysis, predictions, summaries, snapshots, timelines, scan history) and
          reset in-memory caches/state. User accounts are preserved.
        </p>

        <div className="space-y-3">
          <div className="text-sm text-slate-300">Type RESET to confirm:</div>
          <input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 focus:border-rose-500 focus:outline-none"
            placeholder="RESET"
            disabled={resetRunning}
          />

          <button
            onClick={runFactoryReset}
            disabled={!canSubmit}
            className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              canSubmit
                ? "bg-rose-500 text-slate-950 hover:bg-rose-400"
                : "bg-white/5 text-slate-400 cursor-not-allowed"
            }`}
          >
            {resetRunning ? "Resetting..." : "Factory Reset AI System"}
          </button>

          {resetResult ? (
            <div className="pt-2">
              <div className="text-sm text-slate-200 font-medium">Reset verification</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 p-3 text-xs">
                  <div className="text-slate-400">Scanner restarted</div>
                  <div className="text-slate-200">{String(resetResult.scannerRestarted)}</div>
                </div>
                <div className="rounded-lg border border-white/10 p-3 text-xs">
                  <div className="text-slate-400">Tables cleared</div>
                  <div className="text-slate-200">
                    {(resetResult.tablesCleared ?? []).length}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-white/10 p-3 text-xs">
                <div className="text-slate-400 mb-2">After counts (should be 0)</div>
                <pre className="whitespace-pre-wrap break-words text-slate-200">
{JSON.stringify(resetResult.afterCounts ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
