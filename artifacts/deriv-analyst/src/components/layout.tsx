import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMarketSymbols, getGetMarketSymbolsQueryKey, useGetAiStatus, getGetAiStatusQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "../store";
import { useSignalAlert } from "../hooks/useSignalAlert";
import { useAuth } from "../hooks/use-auth";
import { 
  Activity, 
  BarChart2, 
  BrainCircuit, 
  Target, 
  Database, 
  Settings,
  ScanSearch,
  LineChart,
  Cpu,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/scanner", label: "Scanner", icon: ScanSearch },
  { href: "/intelligence", label: "Intelligence", icon: Cpu },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/indicators", label: "Indicators", icon: BarChart2 },
  { href: "/analysis", label: "AI Analysis", icon: BrainCircuit },
  { href: "/predictions", label: "Predictions", icon: Target },
  { href: "/memory", label: "Memory", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

function AlertMonitor() {
  useSignalAlert();
  return null;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { selectedSymbol, setSelectedSymbol, granularity, setGranularity } = useAppStore();
  const { user, logout } = useAuth();
  const isAuthPage = location === "/login" || location === "/register";

  const { data: symbols, isLoading: isLoadingSymbols } = useGetMarketSymbols({
    query: {
      queryKey: getGetMarketSymbolsQueryKey(),
      staleTime: 1000 * 60 * 60,
    }
  });

  const { data: aiStatus } = useGetAiStatus({
    query: {
      queryKey: getGetAiStatusQueryKey(),
      refetchInterval: 30000,
    }
  });

  if (isAuthPage) {
    return <div className="dark min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground dark">
      <AlertMonitor />

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
        <div className="p-4 border-t border-border space-y-4">
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
          
          {user && (
            <div className="flex items-center justify-between p-2 border border-border rounded-lg bg-background/50">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold truncate">
                    {user.role}
                  </div>
                  <div className="text-xs font-medium truncate">{user.email}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
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

                    {(Array.isArray(symbols) ? symbols : Array.isArray((symbols as any)?.data) ? (symbols as any).data : []).map((sym) => (
                      <SelectItem key={sym.symbol} value={sym.symbol}>
                        {sym.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

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
            {user && (
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <UserIcon className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span>{user.email}</span>
                        <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
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
