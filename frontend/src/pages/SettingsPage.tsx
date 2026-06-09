import { GlassCard } from "@/components/ui/Cards";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mt-2 text-sm text-slate-400">Dark mode is enabled by default. Backend URL: /api</p>
      </GlassCard>
    </div>
  );
}
