import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import RouteErrorBoundary from "./components/error/RouteErrorBoundary";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MarketIntelligencePage from "./pages/MarketIntelligencePage";
import AiPredictionsPage from "./pages/AiPredictionsPage";
import SymbolAnalysisPage from "./pages/SymbolAnalysisPage";
import MemoryHistoryPage from "./pages/MemoryHistoryPage";
import SettingsPage from "./pages/SettingsPage";
import IntelligenceHubPage from "./pages/IntelligenceHubPage";
import AnalyticsPage from "./pages/AnalyticsPage";

export default function App() {
  return (
    <RouteErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="market-intelligence" element={<MarketIntelligencePage />} />
          <Route path="ai-predictions" element={<AiPredictionsPage />} />
          <Route path="symbol-analysis" element={<SymbolAnalysisPage />} />
          <Route path="memory-history" element={<MemoryHistoryPage />} />
          <Route path="intelligence-hub" element={<IntelligenceHubPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </RouteErrorBoundary>
  );
}
