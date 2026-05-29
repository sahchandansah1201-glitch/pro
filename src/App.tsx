import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { RoleProvider } from "@/context/RoleContext";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayout } from "@/components/shell/AppLayout";
import { RoleGuard } from "@/components/shell/RoleGuard";
import { RoleHome } from "@/components/shell/RoleHome";

import LoginPage from "./pages/Login";
import SelfHostedLoginPage from "./pages/SelfHostedLoginPage";
import NotFound from "./pages/NotFound.tsx";
import AnalysisPublicPage from "./pages/public/AnalysisPublicPage";
import DeskPage from "./pages/doctor/DeskPage";
import CockpitPage from "./pages/doctor/CockpitPage";
import PrivatePracticePage from "./pages/doctor/PrivatePracticePage";
import PatientsPage from "./pages/doctor/PatientsPage";
import PatientDetailPage from "./pages/doctor/PatientDetailPage";
import VisitsPage from "./pages/doctor/VisitsPage";
import DoctorReportsPage from "./pages/doctor/DoctorReportsPage";
import VisitWorkspacePage from "./pages/doctor/VisitWorkspacePage";
import CapturePage from "./pages/doctor/CapturePage";
import LesionDetailPage from "./pages/doctor/LesionDetailPage";
import BotSimPage from "./pages/bot/BotSimPage";
import BotMiniAppBookingPage from "./pages/bot/BotMiniAppBookingPage";
import OperatorConsolePage from "./pages/operator/OperatorConsolePage";
import OperatorBookingRequestsPage from "./pages/operator/OperatorBookingRequestsPage";
import OperatorDialogPage from "./pages/operator/OperatorDialogPage";
import AdminIntegrationsPage from "./pages/admin/AdminIntegrationsPage";
import AdminIntegrationDetailPage from "./pages/admin/AdminIntegrationDetailPage";
import AdminBotSettingsPage from "./pages/admin/AdminBotSettingsPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminHomePage from "./pages/admin/AdminHomePage";
import AdminDoctorsPage from "./pages/admin/AdminDoctorsPage";
import AdminServicesPage from "./pages/admin/AdminServicesPage";
import AdminClinicsPage from "./pages/admin/AdminClinicsPage";
import SysUsersPage from "./pages/sys/SysUsersPage";
import SysDevicesPage from "./pages/sys/SysDevicesPage";
import SysAuditPage from "./pages/sys/SysAuditPage";
import SysAccessEventsPage from "./pages/sys/SysAccessEventsPage";
import SysApiKeysPage from "./pages/sys/SysApiKeysPage";
import SysReleaseStatusPage from "./pages/sys/SysReleaseStatusPage";
import SysSelfHostedOpsPage from "./pages/sys/SysSelfHostedOpsPage";
import MeHomePage from "./pages/patient/MeHomePage";
import MeReportPage from "./pages/patient/MeReportPage";
import MeReportsPage from "./pages/patient/MeReportsPage";
import MeBookingPage from "./pages/patient/MeBookingPage";
import MeRemindersPage from "./pages/patient/MeRemindersPage";
import HelpPage from "./pages/shared/HelpPage";

const queryClient = new QueryClient();

/** Защищённый маршрут под AppShell + RoleGuard. UX-only, NOT a security boundary. */
const G = ({ children }: { children: React.ReactNode }) => <RoleGuard>{children}</RoleGuard>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <RoleProvider>
          <BrowserRouter>
          <Routes>
            {/* Публичные/без shell-маршруты */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/self-hosted/login" element={<SelfHostedLoginPage />} />
            <Route path="/analysis/:token" element={<AnalysisPublicPage />} />

            {/* Все остальные — внутри AppShell */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleHome />} />

              {/* Doctor / clinical */}
              <Route path="/practice" element={<G><PrivatePracticePage /></G>} />
              <Route path="/cockpit" element={<G><CockpitPage /></G>} />
              <Route path="/desk" element={<G><DeskPage /></G>} />
              <Route path="/patients" element={<G><PatientsPage /></G>} />
              <Route path="/visits" element={<G><VisitsPage /></G>} />
              <Route path="/reports" element={<G><DoctorReportsPage /></G>} />
              <Route path="/patients/:id" element={<G><PatientDetailPage /></G>} />
              <Route path="/patients/:id/visits/:visitId" element={<G><VisitWorkspacePage /></G>} />
              <Route path="/patients/:id/lesions/:lesionId" element={<G><LesionDetailPage /></G>} />
              <Route path="/capture" element={<G><CapturePage /></G>} />

              {/* Clinic admin */}
              <Route path="/admin" element={<G><AdminHomePage /></G>} />
              <Route path="/admin/doctors" element={<G><AdminDoctorsPage /></G>} />
              <Route path="/admin/services" element={<G><AdminServicesPage /></G>} />
              <Route path="/admin/clinics" element={<G><AdminClinicsPage /></G>} />
              <Route path="/admin/integrations" element={<G><AdminIntegrationsPage /></G>} />
              <Route path="/admin/integrations/crm/:id" element={<G><AdminIntegrationDetailPage /></G>} />
              <Route path="/admin/bot" element={<G><AdminBotSettingsPage /></G>} />
              <Route path="/admin/analytics" element={<G><AdminAnalyticsPage /></G>} />

              {/* Operator */}
              <Route path="/operator" element={<G><OperatorConsolePage /></G>} />
              <Route path="/operator/booking-requests" element={<G><OperatorBookingRequestsPage /></G>} />
              <Route path="/operator/dialogs/:id" element={<G><OperatorDialogPage /></G>} />

              {/* System admin */}
              <Route path="/sys/users" element={<G><SysUsersPage /></G>} />
              <Route path="/sys/devices" element={<G><SysDevicesPage /></G>} />
              <Route path="/sys/audit" element={<G><SysAuditPage /></G>} />
              <Route path="/sys/access-events" element={<G><SysAccessEventsPage /></G>} />
              <Route path="/sys/release-status" element={<G><SysReleaseStatusPage /></G>} />
              <Route path="/sys/self-hosted-ops" element={<G><SysSelfHostedOpsPage /></G>} />
              <Route path="/sys/api-keys" element={<G><SysApiKeysPage /></G>} />

              {/* Patient portal */}
              <Route path="/me" element={<G><MeHomePage /></G>} />
              <Route path="/me/reports" element={<G><MeReportsPage /></G>} />
              <Route path="/me/reports/:id" element={<G><MeReportPage /></G>} />
              <Route path="/me/booking" element={<G><MeBookingPage /></G>} />
              <Route path="/me/reminders" element={<G><MeRemindersPage /></G>} />

              {/* Симулятор бота */}
              <Route path="/bot-sim" element={<G><BotSimPage /></G>} />
              <Route path="/bot-sim/miniapp/booking" element={<G><BotMiniAppBookingPage /></G>} />

              {/* Shared */}
              <Route path="/help" element={<HelpPage />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
