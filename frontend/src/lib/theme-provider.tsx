import { createContext, useContext, useEffect, useState, PropsWithChildren } from "react";

export type Theme = "dark" | "light" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "dark" | "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// CSS variable sets for each theme
const darkThemeVars = {
  "--bg-950": "#050816",
  "--bg-900": "#0B1223",
  "--bg-800": "#121A2E",
  "--text-100": "#E6EEFF",
  "--text-300": "#A8B3CF",
  "--text-500": "#6C7897",
  "--glass-border": "rgba(255, 255, 255, 0.1)",
  "--glass-bg": "rgba(255, 255, 255, 0.06)",
  "--gradient-1": "rgba(34, 211, 238, 0.08)",
  "--gradient-2": "rgba(59, 130, 246, 0.08)",
  "--gradient-3": "rgba(139, 92, 246, 0.08)",
};

const lightThemeVars = {
  "--bg-950": "#F8FAFC",
  "--bg-900": "#F1F5F9",
  "--bg-800": "#E2E8F0",
  "--text-100": "#0F172A",
  "--text-300": "#334155",
  "--text-500": "#64748B",
  "--glass-border": "rgba(0, 0, 0, 0.1)",
  "--glass-bg": "rgba(255, 255, 255, 0.8)",
  "--gradient-1": "rgba(34, 211, 238, 0.12)",
  "--gradient-2": "rgba(59, 130, 246, 0.12)",
  "--gradient-3": "rgba(139, 92, 246, 0.12)",
};

function applyThemeVars(theme: "dark" | "light") {
  const vars = theme === "dark" ? darkThemeVars : lightThemeVars;
  const root = document.documentElement;
  
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  
  root.style.colorScheme = theme;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored && ["dark", "light", "system"].includes(stored)) {
      setThemeState(stored);
    } else {
      setThemeState("system");
    }
  }, []);

  // Update resolved theme and apply CSS variables when theme changes
  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyThemeVars(resolved);
    
    // Update class for Tailwind
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(resolved);
  }, [theme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const newTheme = getSystemTheme();
      setResolvedTheme(newTheme);
      applyThemeVars(newTheme);
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(newTheme);
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
