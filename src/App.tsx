import { Suspense, lazy } from "react";
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

const LoginPage = lazy(() => import("./pages/Login"));
const SelfHostedLoginPage = lazy(() => import("./pages/SelfHostedLoginPage"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AnalysisPublicPage = lazy(() => import("./pages/public/AnalysisPublicPage"));
const DeskPage = lazy(() => import("./pages/doctor/DeskPage"));
const CockpitPage = lazy(() => import("./pages/doctor/CockpitPage"));
const PrivatePracticePage = lazy(() => import("./pages/doctor/PrivatePracticePage"));
const PatientsPage = lazy(() => import("./pages/doctor/PatientsPage"));
const PatientDetailPage = lazy(() => import("./pages/doctor/PatientDetailPage"));
const VisitsPage = lazy(() => import("./pages/doctor/VisitsPage"));
const DoctorReportsPage = lazy(() => import("./pages/doctor/DoctorReportsPage"));
const VisitWorkspacePage = lazy(() => import("./pages/doctor/VisitWorkspacePage"));
const CapturePage = lazy(() => import("./pages/doctor/CapturePage"));
const LesionDetailPage = lazy(() => import("./pages/doctor/LesionDetailPage"));
const BotSimPage = lazy(() => import("./pages/bot/BotSimPage"));
const BotMiniAppBookingPage = lazy(() => import("./pages/bot/BotMiniAppBookingPage"));
const OperatorConsolePage = lazy(() => import("./pages/operator/OperatorConsolePage"));
const OperatorBookingRequestsPage = lazy(() => import("./pages/operator/OperatorBookingRequestsPage"));
const OperatorDialogPage = lazy(() => import("./pages/operator/OperatorDialogPage"));
const AdminIntegrationsPage = lazy(() => import("./pages/admin/AdminIntegrationsPage"));
const AdminIntegrationDetailPage = lazy(() => import("./pages/admin/AdminIntegrationDetailPage"));
const AdminBotSettingsPage = lazy(() => import("./pages/admin/AdminBotSettingsPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminGovernancePage = lazy(() => import("./pages/admin/AdminGovernancePage"));
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage"));
const AdminDoctorsPage = lazy(() => import("./pages/admin/AdminDoctorsPage"));
const AdminServicesPage = lazy(() => import("./pages/admin/AdminServicesPage"));
const AdminClinicsPage = lazy(() => import("./pages/admin/AdminClinicsPage"));
const SysUsersPage = lazy(() => import("./pages/sys/SysUsersPage"));
const SysDevicesPage = lazy(() => import("./pages/sys/SysDevicesPage"));
const SysAuditPage = lazy(() => import("./pages/sys/SysAuditPage"));
const SysAccessEventsPage = lazy(() => import("./pages/sys/SysAccessEventsPage"));
const SysApiKeysPage = lazy(() => import("./pages/sys/SysApiKeysPage"));
const SysReleaseStatusPage = lazy(() => import("./pages/sys/SysReleaseStatusPage"));
const SysSelfHostedOpsPage = lazy(() => import("./pages/sys/SysSelfHostedOpsPage"));
const MeHomePage = lazy(() => import("./pages/patient/MeHomePage"));
const MeHistoryPage = lazy(() => import("./pages/patient/MeHistoryPage"));
const MeReportPage = lazy(() => import("./pages/patient/MeReportPage"));
const MeReportsPage = lazy(() => import("./pages/patient/MeReportsPage"));
const MeBookingPage = lazy(() => import("./pages/patient/MeBookingPage"));
const MeRemindersPage = lazy(() => import("./pages/patient/MeRemindersPage"));
const HelpPage = lazy(() => import("./pages/shared/HelpPage"));

const queryClient = new QueryClient();

/** Защищённый маршрут под AppShell + RoleGuard. UX-only, NOT a security boundary. */
const G = ({ children }: { children: React.ReactNode }) => <RoleGuard>{children}</RoleGuard>;

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Загрузка...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <RoleProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
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
                  <Route path="/admin/governance" element={<G><AdminGovernancePage /></G>} />

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
                  <Route path="/me/history" element={<G><MeHistoryPage /></G>} />
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
            </Suspense>
          </BrowserRouter>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
