import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMarketSymbols, getGetMarketSymbolsQueryKey, useGetAiStatus, getGetAiStatusQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "../store";
import { useSignalAlert } from "../hooks/useSignalAlert";
import { useAuth } from "../hooks/use-auth";
import { 
  Check,
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
  Menu,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { 
    selectedSymbol, 
    setSelectedSymbol, 
    granularity, 
    setGranularity,
    theme,
    setTheme
  } = useAppStore();
  const { user, logout } = useAuth();
  const isAuthPage = location === "/login" || location === "/register";

  const closeSidebar = () => setSidebarOpen(false);

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

  useEffect(() => {
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (isAuthPage) {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return <div className={`${isDark ? 'dark' : ''} min-h-screen bg-background text-foreground`}>{children}</div>;
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-background text-foreground ${theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : ''}`}>
      <AlertMonitor />

{/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex-col hidden md:flex">
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

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={closeSidebar}
          />
          <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 flex flex-col md:hidden animate-in slide-in-from-left">
            <div className="h-14 border-b border-border flex items-center justify-between px-4">
              <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
                <BrainCircuit className="h-5 w-5 text-blue-500" />
                <span>Deriv<span className="text-blue-500">Analyst</span></span>
              </div>
              <Button variant="ghost" size="icon" onClick={closeSidebar}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={closeSidebar}>
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
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
{/* Topbar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-2 sm:px-6 gap-2 sm:gap-4">
          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

<div className="flex items-center gap-2 sm:gap-4 flex-1 flex-wrap sm:flex-nowrap min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Symbol</span>
              {isLoadingSymbols ? (
                <Skeleton className="h-9 w-[100px] sm:w-[180px]" />
              ) : (
<Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                  <SelectTrigger className="w-[140px] sm:w-[180px] bg-background border-border">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>

                    {(Array.isArray(symbols) ? symbols : Array.isArray((symbols as any)?.data) ? (symbols as any).data : []).map((sym: any) => (
                      <SelectItem key={sym.symbol} value={sym.symbol}>
                        {sym.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden lg:inline">Interval</span>
<Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger className="w-[80px] sm:w-[120px] bg-background border-border">
                  <SelectValue placeholder="Intvl" />
                </SelectTrigger>
                <SelectContent className="max-h-[400px] overflow-y-auto">
                  <SelectGroup>
                    <SelectLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ticks</SelectLabel>
                    {[
                      { value: "1t", label: "1 Tick" },
                      { value: "5t", label: "5 Ticks" },
                      { value: "10t", label: "10 Ticks" },
                      { value: "25t", label: "25 Ticks" },
                      { value: "50t", label: "50 Ticks" },
                      { value: "100t", label: "100 Ticks" },
                    ].map((item) => (
                      <SelectItem key={item.value} value={item.value} className="relative flex items-center pr-8">
                        <span className="flex-1">{item.label}</span>
                        {granularity === item.value && (
                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                            <Check className="h-4 w-4 opacity-100" />
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <div className="h-px bg-muted my-1 mx-1" />
                  <SelectGroup>
                    <SelectLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Seconds</SelectLabel>
                    {[
                      { value: "1", label: "1s" },
                      { value: "5", label: "5s" },
                      { value: "10", label: "10s" },
                      { value: "15", label: "15s" },
                      { value: "30", label: "30s" },
                    ].map((item) => (
                      <SelectItem key={item.value} value={item.value} className="relative flex items-center pr-8">
                        <span className="flex-1">{item.label}</span>
                        {granularity === item.value && (
                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                            <Check className="h-4 w-4 opacity-100" />
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <div className="h-px bg-muted my-1 mx-1" />
                  <SelectGroup>
                    <SelectLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Minutes</SelectLabel>
                    {[
                      { value: "60", label: "1m" },
                      { value: "120", label: "2m" },
                      { value: "180", label: "3m" },
                      { value: "300", label: "5m" },
                      { value: "600", label: "10m" },
                      { value: "900", label: "15m" },
                      { value: "1800", label: "30m" },
                    ].map((item) => (
                      <SelectItem key={item.value} value={item.value} className="relative flex items-center pr-8">
                        <span className="flex-1">{item.label}</span>
                        {granularity === item.value && (
                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                            <Check className="h-4 w-4 opacity-100" />
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <div className="h-px bg-muted my-1 mx-1" />
                  <SelectGroup>
                    <SelectLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hours</SelectLabel>
                    {[
                      { value: "3600", label: "1h" },
                      { value: "7200", label: "2h" },
                      { value: "14400", label: "4h" },
                    ].map((item) => (
                      <SelectItem key={item.value} value={item.value} className="relative flex items-center pr-8">
                        <span className="flex-1">{item.label}</span>
                        {granularity === item.value && (
                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                            <Check className="h-4 w-4 opacity-100" />
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <div className="h-px bg-muted my-1 mx-1" />
                  <SelectGroup>
                    <SelectLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End Time</SelectLabel>
                    {[
                      { value: "current", label: "Current" },
                      { value: "plus5m", label: "+5m" },
                      { value: "plus15m", label: "+15m" },
                      { value: "plus30m", label: "+30m" },
                      { value: "plus1h", label: "+1h" },
                      { value: "custom", label: "Custom" },
                    ].map((item) => (
                      <SelectItem key={item.value} value={item.value} className="relative flex items-center pr-8">
                        <span className="flex-1">{item.label}</span>
                        {granularity === item.value && (
                          <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                            <Check className="h-4 w-4 opacity-100" />
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Theme</span>
<Select value={theme} onValueChange={(val: any) => setTheme(val)}>
                <SelectTrigger className="w-[70px] sm:w-[100px] bg-background border-border">
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
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
