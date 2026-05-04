import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { RoleProvider } from "@/context/RoleContext";
import { AppLayout } from "@/components/shell/AppLayout";
import Dashboard from "./pages/Dashboard";
import {
  PatientsPage,
  VisitsPage,
  SchedulePage,
  ImagesPage,
  BotPage,
  ReportsPage,
  RemindersPage,
  ClinicPage,
  IntegrationsPage,
  DevicesPage,
  AccessPage,
  AuditPage,
  HelpPage,
} from "./pages/Placeholders";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/visits" element={<VisitsPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/images" element={<ImagesPage />} />
              <Route path="/bot" element={<BotPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reminders" element={<RemindersPage />} />
              <Route path="/clinic" element={<ClinicPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/access" element={<AccessPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
