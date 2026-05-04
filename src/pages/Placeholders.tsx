import { PlaceholderPage } from "@/components/shell/PageHeader";

export const PatientsPage = () => (
  <PlaceholderPage title="Пациенты" subtitle="Список пациентов, фильтры, карточка пациента." />
);
export const VisitsPage = () => (
  <PlaceholderPage title="Визиты" subtitle="6 вкладок: Intake · Body Map · Imaging · Assessment · Conclusion · Report." />
);
export const SchedulePage = () => (
  <PlaceholderPage title="Расписание" subtitle="Слоты врачей, услуги, записи из бота." />
);
export const ImagesPage = () => (
  <PlaceholderPage title="Изображения" subtitle="Обзорные и дерматоскопические снимки, контроль качества." />
);
export const BotPage = () => (
  <PlaceholderPage
    title="Бот и лиды"
    subtitle="Диалоги, ProtectedAnalysisLink, маршрутизация в клинику."
    note="Здесь будет очередь диалогов, AnalysisCard и эскалация оператору."
  />
);
export const ReportsPage = () => (
  <PlaceholderPage title="Отчёты пациента" subtitle="Врачебный отчёт после приёма, sharedLink." />
);
export const RemindersPage = () => (
  <PlaceholderPage title="Напоминания" subtitle="Контроль рехаба, плановые осмотры, follow-up." />
);
export const ClinicPage = () => (
  <PlaceholderPage title="Клиника и услуги" subtitle="Врачи, услуги, тарифы, партнёрский маршрутинг." />
);
export const IntegrationsPage = () => (
  <PlaceholderPage
    title="Интеграции"
    subtitle="CRM · ERP · МИС. Только DryRun, mapping и safe summary."
    note="Фото, диагнозы, AI/XAI и PHI не отправляются во внешние системы по умолчанию."
  />
);
export const DevicesPage = () => (
  <PlaceholderPage title="Устройства" subtitle="Электронные дерматоскопы, Device Bridge, локальный перенос с телефона." />
);
export const AccessPage = () => (
  <PlaceholderPage
    title="Доступ и роли"
    subtitle="RoleGuard и роли — UX-симуляция в MVP."
    note="Реальная авторизация появится после подключения Lovable Cloud."
  />
);
export const AuditPage = () => (
  <PlaceholderPage title="Аудит" subtitle="Журнал действий, экспорт, защищённые ссылки." />
);
export const HelpPage = () => (
  <PlaceholderPage title="Справка" subtitle="Документация по ролям и потокам." />
);
