import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Scanner from "@/pages/scanner";
import Analytics from "@/pages/analytics";
import Indicators from "@/pages/indicators";
import Analysis from "@/pages/analysis";
import Predictions from "@/pages/predictions";
import Memory from "@/pages/memory";
import Settings from "@/pages/settings";
import Intelligence from "@/pages/intelligence";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return <Component {...rest} />;
}

function Router() {
  const { user } = useAuth();

  return (
    <Layout>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        
        <Route path="/">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/scanner">
          <ProtectedRoute component={Scanner} />
        </Route>
        <Route path="/intelligence">
          <ProtectedRoute component={Intelligence} />
        </Route>
        <Route path="/analytics">
          <ProtectedRoute component={Analytics} />
        </Route>
        <Route path="/indicators">
          <ProtectedRoute component={Indicators} />
        </Route>
        <Route path="/analysis">
          <ProtectedRoute component={Analysis} />
        </Route>
        <Route path="/predictions">
          <ProtectedRoute component={Predictions} />
        </Route>
        <Route path="/memory">
          <ProtectedRoute component={Memory} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={Settings} />
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;