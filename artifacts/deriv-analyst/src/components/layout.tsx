import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMarketSymbols, getGetMarketSymbolsQueryKey, useGetAiStatus, getGetAiStatusQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "../store";
import { 
  Activity, 
  BarChart2, 
  BrainCircuit, 
  Target, 
  Database, 
  Settings,
  ChevronDown,
  Wifi,
  WifiOff
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/indicators", label: "Indicators", icon: BarChart2 },
  { href: "/analysis", label: "AI Analysis", icon: BrainCircuit },
  { href: "/predictions", label: "Predictions", icon: Target },
  { href: "/memory", label: "Memory", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { selectedSymbol, setSelectedSymbol, granularity, setGranularity } = useAppStore();

  const { data: symbols, isLoading: isLoadingSymbols } = useGetMarketSymbols({
    query: {
      queryKey: getGetMarketSymbolsQueryKey(),
      staleTime: 1000 * 60 * 60, // 1 hour
    }
  });

  const { data: aiStatus } = useGetAiStatus({
    query: {
      queryKey: getGetAiStatusQueryKey(),
      refetchInterval: 30000,
    }
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground dark">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="h-14 border-b border-border flex items-center px-4">
          <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
            <BrainCircuit className="h-5 w-5 text-blue-500" />
            <span>Deriv<span className="text-blue-500">Analyst</span></span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                  isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}>
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            {aiStatus?.online ? (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-500 font-medium">AI Engine Online</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-destructive font-medium">AI Engine Offline</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            {/* Symbol Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Symbol</span>
              {isLoadingSymbols ? (
                <Skeleton className="h-9 w-[180px]" />
              ) : (
                <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                  <SelectTrigger className="w-[180px] bg-background border-border">
                    <SelectValue placeholder="Select symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {symbols?.map((sym) => (
                      <SelectItem key={sym.symbol} value={sym.symbol}>
                        {sym.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Granularity Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Interval</span>
              <Select value={granularity.toString()} onValueChange={(val) => setGranularity(parseInt(val, 10))}>
                <SelectTrigger className="w-[100px] bg-background border-border">
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 Min</SelectItem>
                  <SelectItem value="300">5 Min</SelectItem>
                  <SelectItem value="900">15 Min</SelectItem>
                  <SelectItem value="3600">1 Hour</SelectItem>
                  <SelectItem value="86400">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Mobile menu could go here */}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-background p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
