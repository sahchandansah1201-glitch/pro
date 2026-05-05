import { useParams } from "react-router-dom";
import { PlaceholderPage } from "@/components/shell/PageHeader";

// ───────── Клиника / врач ─────────
export const DeskPage = () => (
  <PlaceholderPage title="Рабочий стол врача" subtitle="Очередь визитов, приоритеты, последние пациенты." />
);
export const PatientsPage = () => (
  <PlaceholderPage title="Пациенты" subtitle="Список пациентов, фильтры, карточка пациента." />
);
export const PatientDetailPage = () => {
  const { id } = useParams();
  return <PlaceholderPage title={`Пациент №${id ?? "—"}`} subtitle="Карточка пациента: визиты, lesions, фото, отчёты." />;
};
export const VisitWorkspacePage = () => {
  const { id, visitId } = useParams();
  return (
    <PlaceholderPage
      title={`Визит ${visitId ?? "—"} · пациент ${id ?? "—"}`}
      subtitle="6 вкладок: Intake · Body Map · Imaging · Assessment · Conclusion · Report."
    />
  );
};
export const LesionPage = () => {
  const { id, lesionId } = useParams();
  return (
    <PlaceholderPage
      title={`Образование ${lesionId ?? "—"}`}
      subtitle={`Пациент ${id ?? "—"} · таймлайн снимков, сравнение, ABCD/7-point.`}
    />
  );
};

// ───────── Администратор клиники ─────────
// AdminHomePage, AdminDoctorsPage, AdminServicesPage, AdminClinicsPage
//   moved to src/pages/admin/Admin{Home,Doctors,Services,Clinics}Page.tsx (Task 17).
// AdminBotPage moved to src/pages/admin/AdminBotSettingsPage.tsx (Task 15).
// AdminAnalyticsPage moved to src/pages/admin/AdminAnalyticsPage.tsx (Task 16).
// AdminIntegrationsPage / AdminIntegrationDetailPage реализованы отдельно.

// ───────── Оператор поддержки (реализован в OperatorConsolePage / OperatorDialogPage) ─────────


// ───────── Системный администратор ─────────
// SysUsersPage, SysDevicesPage, SysAuditPage, SysApiKeysPage moved to
// src/pages/sys/Sys{Users,Devices,Audit,ApiKeys}Page.tsx (Task 18).

// ───────── Пациент ─────────
export const MeHomePage = () => (
  <PlaceholderPage title="Личный кабинет" subtitle="Отчёты, записи, напоминания." />
);
export const MeReportPage = () => {
  const { id } = useParams();
  return <PlaceholderPage title={`Отчёт ${id ?? "—"}`} subtitle="Заключение врача, рекомендации, повторный визит." />;
};
export const MeBookingPage = () => (
  <PlaceholderPage title="Запись на приём" subtitle="Выбор врача, услуги и слота." />
);
export const MeRemindersPage = () => (
  <PlaceholderPage title="Напоминания" subtitle="Контроль рехаба, плановые осмотры, follow-up." />
);

// ───────── Защищённый просмотр и бот-симулятор ─────────
export const AnalysisTokenPage = () => {
  const { token } = useParams();
  return (
    <PlaceholderPage
      title="Защищённый просмотр анализа"
      subtitle={`Токен: ${token ?? "—"}. Ограниченный доступ по ссылке.`}
    />
  );
};
// ───────── Общее ─────────
export const HelpPage = () => (
  <PlaceholderPage title="Справка" subtitle="Документация по ролям и потокам." />
);
