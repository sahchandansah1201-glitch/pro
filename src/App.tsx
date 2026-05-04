import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { RoleProvider } from "@/context/RoleContext";
import { AppLayout } from "@/components/shell/AppLayout";
import { RoleGuard } from "@/components/shell/RoleGuard";
import { RoleHome } from "@/components/shell/RoleHome";

import LoginPage from "./pages/Login";
import NotFound from "./pages/NotFound.tsx";
import {
  // Doctor / clinical
  DeskPage,
  PatientsPage,
  PatientDetailPage,
  VisitWorkspacePage,
  LesionPage,
  CapturePage,
  // Clinic admin
  AdminHomePage,
  AdminDoctorsPage,
  AdminServicesPage,
  AdminClinicsPage,
  AdminIntegrationsPage,
  AdminCrmDetailPage,
  AdminBotPage,
  AdminAnalyticsPage,
  // Operator
  OperatorHomePage,
  OperatorDialogPage,
  // System admin
  SysUsersPage,
  SysDevicesPage,
  SysAuditPage,
  SysApiKeysPage,
  // Patient
  MeHomePage,
  MeReportPage,
  MeBookingPage,
  MeRemindersPage,
  // Public/protected
  AnalysisTokenPage,
  BotSimPage,
  BotSimMiniAppBookingPage,
  // Shared
  HelpPage,
} from "./pages/Placeholders";

const queryClient = new QueryClient();

/** Защищённый маршрут под AppShell + RoleGuard. UX-only, NOT a security boundary. */
const G = ({ children }: { children: React.ReactNode }) => <RoleGuard>{children}</RoleGuard>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            {/* Публичные/без shell-маршруты */}
            <Route path="/login" element={<LoginPage />} />

            {/* Все остальные — внутри AppShell */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleHome />} />

              {/* Doctor / clinical */}
              <Route path="/desk" element={<G><DeskPage /></G>} />
              <Route path="/patients" element={<G><PatientsPage /></G>} />
              <Route path="/patients/:id" element={<G><PatientDetailPage /></G>} />
              <Route path="/patients/:id/visits/:visitId" element={<G><VisitWorkspacePage /></G>} />
              <Route path="/patients/:id/lesions/:lesionId" element={<G><LesionPage /></G>} />
              <Route path="/capture" element={<G><CapturePage /></G>} />

              {/* Clinic admin */}
              <Route path="/admin" element={<G><AdminHomePage /></G>} />
              <Route path="/admin/doctors" element={<G><AdminDoctorsPage /></G>} />
              <Route path="/admin/services" element={<G><AdminServicesPage /></G>} />
              <Route path="/admin/clinics" element={<G><AdminClinicsPage /></G>} />
              <Route path="/admin/integrations" element={<G><AdminIntegrationsPage /></G>} />
              <Route path="/admin/integrations/crm/:id" element={<G><AdminCrmDetailPage /></G>} />
              <Route path="/admin/bot" element={<G><AdminBotPage /></G>} />
              <Route path="/admin/analytics" element={<G><AdminAnalyticsPage /></G>} />

              {/* Operator */}
              <Route path="/operator" element={<G><OperatorHomePage /></G>} />
              <Route path="/operator/dialogs/:id" element={<G><OperatorDialogPage /></G>} />

              {/* System admin */}
              <Route path="/sys/users" element={<G><SysUsersPage /></G>} />
              <Route path="/sys/devices" element={<G><SysDevicesPage /></G>} />
              <Route path="/sys/audit" element={<G><SysAuditPage /></G>} />
              <Route path="/sys/api-keys" element={<G><SysApiKeysPage /></G>} />

              {/* Patient portal */}
              <Route path="/me" element={<G><MeHomePage /></G>} />
              <Route path="/me/reports/:id" element={<G><MeReportPage /></G>} />
              <Route path="/me/booking" element={<G><MeBookingPage /></G>} />
              <Route path="/me/reminders" element={<G><MeRemindersPage /></G>} />

              {/* Защищённый просмотр и симулятор бота */}
              <Route path="/analysis/:token" element={<G><AnalysisTokenPage /></G>} />
              <Route path="/bot-sim" element={<G><BotSimPage /></G>} />
              <Route path="/bot-sim/miniapp/booking" element={<G><BotSimMiniAppBookingPage /></G>} />

              {/* Shared */}
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
