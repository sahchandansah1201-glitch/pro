import { useParams } from "react-router-dom";
import { PlaceholderPage } from "@/components/shell/PageHeader";

const BACKEND_NOTE =
  "Реальные роли, RLS и аудит включаются на этапе бэкенда.";

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

// ───────── Администратор клиники (интеграции реализованы в AdminIntegrationsPage / AdminIntegrationDetailPage) ─────────
export const AdminHomePage = () => (
  <PlaceholderPage title="Администрирование клиники" subtitle="Сводка по клинике, лидам и расписанию." />
);
export const AdminDoctorsPage = () => (
  <PlaceholderPage title="Врачи" subtitle="Состав, специализации, расписание, лицензии." />
);
export const AdminServicesPage = () => (
  <PlaceholderPage title="Услуги и тарифы" subtitle="Каталог услуг, цены, длительность." />
);
export const AdminClinicsPage = () => (
  <PlaceholderPage title="Клиники и филиалы" subtitle="Адреса, контакты, партнёрский маршрутинг." />
);
// AdminBotPage moved to src/pages/admin/AdminBotSettingsPage.tsx (Task 15).
export const AdminAnalyticsPage = () => (
  <PlaceholderPage title="Аналитика" subtitle="Конверсия лидов, загрузка слотов, источники." />
);

// ───────── Оператор поддержки (реализован в OperatorConsolePage / OperatorDialogPage) ─────────


// ───────── Системный администратор ─────────
export const SysUsersPage = () => (
  <PlaceholderPage
    title="Пользователи и роли"
    subtitle="Управление учётными записями и назначением ролей."
    backendNote={BACKEND_NOTE}
  />
);
export const SysDevicesPage = () => (
  <PlaceholderPage title="Устройства" subtitle="Электронные дерматоскопы, Device Bridge, локальный перенос с телефона." />
);
export const SysAuditPage = () => (
  <PlaceholderPage title="Аудит" subtitle="Журнал действий, экспорт, защищённые ссылки." />
);
export const SysApiKeysPage = () => (
  <PlaceholderPage title="API-ключи" subtitle="Ключи интеграций и сервисных аккаунтов." backendNote={BACKEND_NOTE} />
);

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
