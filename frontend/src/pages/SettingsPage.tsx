import { GlassCard } from "@/components/ui/Cards";
import { useTheme, Theme } from "@/lib/theme-provider";

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "💻" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

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
    </div>
  );
}
