import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  collectStage4MChecks,
  validateLiveE2EContract,
  validateStage4MDbSmokeContract,
} from "./check-stage4m-production-deploy.mjs";

test("Stage 4M production deployment guard passes on repository files", () => {
  const result = collectStage4MChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 90);
});

test("Stage 4M guard requires the production auth/session live journey", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-auth-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-auth-session-live.pw.ts"),
    'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText } from "./live-admin-test-helpers";',
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /production-auth-session-live\.pw\.ts missing live coverage marker: \/api\/v1\/auth\/login/);
  assert.match(errors.join("\n"), /production-auth-session-live\.pw\.ts missing live coverage marker: Сессия истекла/);
  assert.match(errors.join("\n"), /production-auth-session-live\.pw\.ts missing live coverage marker: live-auth-invalid-mobile-390\.png/);
});

test("Stage 4M guard requires the read-only RDS-3 receipt journey", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-rds3-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-rds3-import-live.pw.ts"),
    'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink } from "./live-admin-test-helpers";',
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /production-rds3-import-live\.pw\.ts missing live coverage marker: Дерматоскопия · Прибор/);
  assert.match(errors.join("\n"), /production-rds3-import-live\.pw\.ts missing live coverage marker: Рабочее место · Ассистент/);
  assert.match(errors.join("\n"), /production-rds3-import-live\.pw\.ts missing live coverage marker: live-rds3-assistant-mobile-390\.png/);
  assert.match(errors.join("\n"), /production-rds3-import-live\.pw\.ts missing live coverage marker: live-rds3-doctor-mobile-390\.png/);
});

test("Stage 4M guard rejects ambiguous live e2e main locators", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-e2e-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'function appMain(page: Page) {',
      '  return page.locator("main").first();',
      '}',
      'await expect(page.locator("main")).not.toContainText(/backend/);',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /ambiguous page\.locator\("main"\)/);
});

test("Stage 4M guard requires live help section coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-help-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'function appMain(page: Page) {',
      '  return page.locator("main").first();',
      '}',
      'await expect(appMain(page)).not.toContainText(/backend/);',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: Справка/);
});

test("Stage 4M guard requires invalid employee password coverage before account creation", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-user-validation-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainLink, mainText, sidebarLink } from "./live-admin-test-helpers";',
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: Создание сотрудника/);
  assert.match(errors.join("\n"), /missing live coverage marker: 123456789/);
  assert.match(errors.join("\n"), /missing live coverage marker: adminUserCreateRequestCount/);
  assert.match(errors.join("\n"), /missing live coverage marker: live-admin-users-validation-mobile-390\.png/);
});

test("Stage 4M guard requires clinic admin services live coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-services-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainLink, mainText, sidebarLink } from "./live-admin-test-helpers";',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: \/api\/v1\/admin\/services/);
  assert.match(errors.join("\n"), /missing live coverage marker: Создать услугу/);
  assert.match(errors.join("\n"), /missing live coverage marker: live-clinic-admin-services-desktop-1280\.png/);
});

test("Stage 4M guard requires clinic admin governance live coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-governance-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainLink, mainText, sidebarLink } from "./live-admin-test-helpers";',
      "test.setTimeout(90_000);",
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"Услуги";',
      '"/api/v1/admin/services";',
      '"Создать услугу";',
      '"Редактирование услуги";',
      '"Сохранить услугу";',
      '"live-clinic-admin-services-desktop-1280.png";',
      '"live-clinic-admin-services-mobile-390.png";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: Управление доступом/);
  assert.match(errors.join("\n"), /missing live coverage marker: \/api\/v1\/patient-photo-protocol-release\/governance/);
  assert.match(errors.join("\n"), /missing live coverage marker: live-clinic-admin-governance-desktop-1280\.png/);
});

test("Stage 4M guard requires explicit admin live e2e timeout", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-admin-timeout-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink } from "./live-admin-test-helpers";',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"Услуги";',
      '"/api/v1/admin/services";',
      '"Создать услугу";',
      '"Редактирование услуги";',
      '"Сохранить услугу";',
      '"live-clinic-admin-services-desktop-1280.png";',
      '"live-clinic-admin-services-mobile-390.png";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: test\.setTimeout\(90_000\)/);
});

test("Stage 4M guard rejects ambiguous live e2e sidebar link locators", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-sidebar-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'function appMain(page: Page) {',
      '  return page.locator("main").first();',
      '}',
      'function bannerText(page: Page, text: string | RegExp) {',
      '  return page.getByRole("banner").getByText(text).filter({ visible: true }).first();',
      '}',
      'function mainText(page: Page, text: string | RegExp) {',
      '  return appMain(page).getByText(text).filter({ visible: true }).first();',
      '}',
      'function sidebarLink(page: Page, name: string) {',
      '  return page.locator(\'[data-sidebar="menu-button"]\').filter({ hasText: name }).first();',
      '}',
      'await page.getByRole("link", { name: "Клиники и кабинеты" }).click();',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /uses direct getByRole\("link"\); use mainLink\(page, \.\.\.\) or sidebarLink/);
});

test("Stage 4M guard requires centralized live admin e2e helpers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-helper-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'function appMain(page: Page) {',
      '  return page.locator("main").first();',
      '}',
      'function sidebarLink(page: Page, name: string) {',
      '  return page.locator(\'[data-sidebar="menu-button"]\').filter({ hasText: name }).first();',
      '}',
      'async function expectNoHorizontalOverflow(page: Page) {}',
      'async function expectMainTapTargets(page: Page) {}',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /must import live admin helpers from \.\/live-admin-test-helpers/);
});

test("Stage 4M guard rejects any direct live e2e link locator", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-direct-link-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink } from "./live-admin-test-helpers";',
      'await page.getByRole("link", { name: "Новый раздел" }).click();',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /uses direct getByRole\("link"\); use mainLink\(page, \.\.\.\) or sidebarLink/);
});

test("Stage 4M guard rejects scoped direct live e2e link locators", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-scoped-link-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-doctor-workspace-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink } from "./live-admin-test-helpers";',
      'await appMain(page).getByRole("link", { name: updatedPatientFullName }).click();',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Рабочий стол";',
      '"Центр частной практики";',
      '"/api/v1/admin/private-practices";',
      '"/api/v1/doctor/dashboard";',
      '"/api/v1/leads/appointments";',
      '"/api/v1/patients";',
      '"Новый пациент";',
      '"Создать пациента";',
      '"Сохранить изменения";',
      '"Архивировать";',
      '"live-doctor-desk-desktop-1280.png";',
      '"live-doctor-desk-mobile-390.png";',
      '"live-doctor-patients-desktop-1280.png";',
      '"live-doctor-patients-mobile-390.png";',
      '"live-private-doctor-practice-desktop-1280.png";',
      '"live-private-doctor-practice-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /production-doctor-workspace-live\.pw\.ts:2 uses direct getByRole\("link"\); use mainLink\(page, \.\.\.\) or sidebarLink/);
});

test("Stage 4M guard rejects semicolon-split SQL joins in live fixtures", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-sql-join-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-patient-portal-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainLink, mainText, pageHeaderText, sidebarLink } from "./live-admin-test-helpers";',
      "const sql = `",
      "from upserted_clinic c",
      "cross join created_report r;",
      "cross join upserted_patient p;",
      "`;",
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Личный кабинет";',
      '"История очагов";',
      '"Заключения";',
      '"Заключение для пациента";',
      '"Запись на приём";',
      '"Напоминания";',
      '"/api/v1/me/portal";',
      '"/api/v1/me/history";',
      '"/api/v1/me/reports/";',
      '"/api/v1/me/booking-requests";',
      '"/api/v1/me/reminder-preferences";',
      '"/api/v1/me/follow-ups";',
      '"Причина запроса на запись";',
      '"Отправить запрос";',
      '"Сохранить настройки";',
      '"live-patient-home-desktop-1280.png";',
      '"live-patient-home-mobile-390.png";',
      '"live-patient-history-desktop-1280.png";',
      '"live-patient-reports-desktop-1280.png";',
      '"live-patient-report-detail-desktop-1280.png";',
      '"live-patient-report-detail-mobile-390.png";',
      '"live-patient-booking-desktop-1280.png";',
      '"live-patient-booking-mobile-390.png";',
      '"live-patient-reminders-desktop-1280.png";',
      '"live-patient-reminders-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /contains a semicolon before a following cross join/);
});

test("Stage 4M guard rejects duplicate report public-analysis live fixtures", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-public-analysis-report-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-public-analysis-live.pw.ts"),
    [
      'import { appMain, expectMainTapTargets, expectNoHorizontalOverflow, mainText } from "./live-admin-test-helpers";',
      'const sql = `',
      'inserted_reports as (',
      '  insert into reports (visit_id) select v.id from inserted_visit v union all select v.id from inserted_visit v',
      '),',
      'numbered_reports as (select id from inserted_reports)',
      '`;',
      '"/analysis/";',
      '"/api/v1/public/analysis/";',
      '"Предварительная сводка";',
      '"Ссылка истекла";',
      '"Ссылка не найдена";',
      '"public_analysis_links";',
      '"token_hash";',
      '"validToken";',
      '"expiredToken";',
      '"missingToken";',
      '"live-public-analysis-valid-desktop-1280.png";',
      '"live-public-analysis-valid-mobile-390.png";',
      '"live-public-analysis-expired-desktop-1280.png";',
      '"live-public-analysis-missing-desktop-1280.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /duplicate reports for one visit violate reports_visit_id_unique_idx/);
});

test("Stage 4M guard rejects fixed patient portal DB smoke fixture UUID inserts", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-patient-db-smoke-contract-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(
    join(root, "scripts", "stage4m-patient-portal-db-smoke.mjs"),
    [
      "const PATIENT_USER_ID = '10000000-0000-4000-8000-000000000211';",
      "insert into app_users (id) values ('10000000-0000-4000-8000-000000000211'::uuid);",
    ].join("\n"),
  );

  const errors = [];
  validateStage4MDbSmokeContract(errors, root);

  assert.match(errors.join("\n"), /must generate transaction-local fixture UUIDs/);
  assert.match(errors.join("\n"), /must not insert fixed Stage 4M fixture UUIDs/);
  assert.match(errors.join("\n"), /must execute the production patient follow-up JSON SQL directly/);
  assert.match(errors.join("\n"), /patient follow-up list must return a JSON array/);
});

test("Stage 4M guard rejects patient follow-up SQL without the runtime JSON array contract", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-patient-follow-up-json-contract-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "backend", "self-hosted"), { recursive: true });
  writeFileSync(
    join(root, "scripts", "stage4m-patient-portal-db-smoke.mjs"),
    [
      "fixture_patient_user_id uuid := gen_random_uuid();",
      "fixture_report_id uuid := gen_random_uuid();",
      "fixture_follow_up_id uuid := gen_random_uuid();",
      "const followUpsSql = withoutTrailingSemicolon(buildListPatientFollowUpsSql({",
      "  userId: PATIENT_USER_ID_PLACEHOLDER,",
      "}));",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "backend", "self-hosted", "clinical-followup-repository.mjs"),
    [
      "export function buildListPatientFollowUpsSql() {",
      "  return `select f.id from clinical_follow_up_tasks f`;",
      "}",
      "export function buildCreatePatientFollowUpMessageSql() {}",
    ].join("\n"),
  );

  const errors = [];
  validateStage4MDbSmokeContract(errors, root);

  assert.deepEqual(errors, [
    "backend/self-hosted/clinical-followup-repository.mjs patient follow-up list must return a JSON array for empty and populated results",
  ]);
});

test("Stage 4M guard rejects direct live e2e page text locators", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-role-text-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink } from "./live-admin-test-helpers";',
      'await expect(page.getByText(/Администратор клиники/)).toBeVisible();',
      'await expect(bannerText(page, "Рабочее место · Администратор клиники")).toBeVisible();',
      'await expect(mainText(page, "Нет доступа")).toBeVisible();',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /uses direct page\.getByText; use mainText\(page, \.\.\.\), bannerText\(page, \.\.\.\), or a scoped locator/);
});

test("Stage 4M guard rejects order-dependent admin audit first-page assertions", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-audit-order-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainLink, mainText, sidebarLink } from "./live-admin-test-helpers";',
      'await expect(appMain(page)).not.toContainText(/backend/);',
      'await expect(mainText(page, /Клиника создана|Сотрудник создан|Роль назначена/).first()).toBeVisible();',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
      '"Устройства";',
      '"/api/v1/device-bridges";',
      '"/api/v1/devices";',
      '"/api/v1/device-bridge-worker/status";',
      '"/api/v1/device-bridge-worker/production-readiness";',
      '"live-admin-devices-desktop-1280.png";',
      '"live-admin-devices-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /must search audit by the current run clinic before asserting created events/);
});

test("Stage 4M guard requires live private doctor practice coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-private-doctor-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  const helperImport =
    'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink } from "./live-admin-test-helpers";';
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );
  writeFileSync(
    join(root, "e2e", "production-doctor-workspace-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Рабочий стол";',
      '"/api/v1/doctor/dashboard";',
      '"/api/v1/leads/appointments";',
      '"live-doctor-desk-desktop-1280.png";',
      '"live-doctor-desk-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: Центр частной практики/);
});

test("Stage 4M guard requires live doctor patient registry coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-doctor-patients-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  const helperImport =
    'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink } from "./live-admin-test-helpers";';
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );
  writeFileSync(
    join(root, "e2e", "production-doctor-workspace-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Рабочий стол";',
      '"Центр частной практики";',
      '"/api/v1/admin/private-practices";',
      '"/api/v1/doctor/dashboard";',
      '"/api/v1/leads/appointments";',
      '"live-doctor-desk-desktop-1280.png";',
      '"live-doctor-desk-mobile-390.png";',
      '"live-private-doctor-practice-desktop-1280.png";',
      '"live-private-doctor-practice-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: \/api\/v1\/patients/);
});

test("Stage 4M guard requires live operator workspace coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-operator-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  const helperImport =
    'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainText, pageHeaderText, sidebarLink } from "./live-admin-test-helpers";';
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );
  writeFileSync(
    join(root, "e2e", "production-doctor-workspace-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Рабочий стол";',
      '"Центр частной практики";',
      '"/api/v1/admin/private-practices";',
      '"/api/v1/doctor/dashboard";',
      '"/api/v1/leads/appointments";',
      '"/api/v1/patients";',
      '"Новый пациент";',
      '"Создать пациента";',
      '"Сохранить изменения";',
      '"Архивировать";',
      '"live-doctor-desk-desktop-1280.png";',
      '"live-doctor-desk-mobile-390.png";',
      '"live-doctor-patients-desktop-1280.png";',
      '"live-doctor-patients-mobile-390.png";',
      '"live-private-doctor-practice-desktop-1280.png";',
      '"live-private-doctor-practice-mobile-390.png";',
    ].join("\n"),
  );
  writeFileSync(
    join(root, "e2e", "production-operator-workspace-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Консоль оператора";',
      '"/api/v1/leads/appointments";',
      '"/api/v1/leads";',
      '"live-operator-console-desktop-1280.png";',
      '"live-operator-console-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: Запросы на запись/);
  assert.match(errors.join("\n"), /missing live coverage marker: Карточка обращения/);
  assert.match(errors.join("\n"), /missing live coverage marker: live-operator-dialog-desktop-1280\.png/);
});

test("Stage 4M guard requires live patient portal coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-patient-contract-"));
  mkdirSync(join(root, "e2e"), { recursive: true });
  const helperImport =
    'import { appMain, bannerText, expectMainTapTargets, expectNoHorizontalOverflow, mainLink, mainText, pageHeaderText, sidebarLink } from "./live-admin-test-helpers";';
  writeFileSync(
    join(root, "e2e", "production-admin-management-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Справка";',
      '"Поиск по разделам справки";',
      '"live-admin-help-desktop-1280.png";',
      '"live-admin-help-mobile-390.png";',
    ].join("\n"),
  );
  writeFileSync(
    join(root, "e2e", "production-doctor-workspace-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Рабочий стол";',
      '"Центр частной практики";',
      '"/api/v1/admin/private-practices";',
      '"/api/v1/doctor/dashboard";',
      '"/api/v1/leads/appointments";',
      '"/api/v1/patients";',
      '"Новый пациент";',
      '"Создать пациента";',
      '"Сохранить изменения";',
      '"Архивировать";',
      '"live-doctor-desk-desktop-1280.png";',
      '"live-doctor-desk-mobile-390.png";',
      '"live-doctor-patients-desktop-1280.png";',
      '"live-doctor-patients-mobile-390.png";',
      '"live-private-doctor-practice-desktop-1280.png";',
      '"live-private-doctor-practice-mobile-390.png";',
    ].join("\n"),
  );
  writeFileSync(
    join(root, "e2e", "production-operator-workspace-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Консоль оператора";',
      '"Запросы на запись";',
      '"/api/v1/leads/appointments";',
      '"/api/v1/leads";',
      '"/api/v1/clinic/booking-requests";',
      '"/api/v1/integrations/booking-imports";',
      '"/api/v1/integrations/booking-imports/status";',
      '"/api/v1/clinic/available-slots";',
      '"live-operator-console-desktop-1280.png";',
      '"live-operator-console-mobile-390.png";',
      '"live-operator-booking-requests-desktop-1280.png";',
      '"live-operator-booking-requests-mobile-390.png";',
    ].join("\n"),
  );
  writeFileSync(
    join(root, "e2e", "production-patient-portal-live.pw.ts"),
    [
      helperImport,
      'await expect(appMain(page)).not.toContainText(/backend/);',
      '"Личный кабинет";',
      '"История очагов";',
      '"Запись на приём";',
      '"/api/v1/me/portal";',
      '"/api/v1/me/history";',
      '"/api/v1/me/booking-requests";',
      '"Причина запроса на запись";',
      '"Отправить запрос";',
      '"live-patient-home-desktop-1280.png";',
      '"live-patient-home-mobile-390.png";',
      '"live-patient-history-desktop-1280.png";',
      '"live-patient-booking-desktop-1280.png";',
      '"live-patient-booking-mobile-390.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: Заключения/);
  assert.match(errors.join("\n"), /missing live coverage marker: \/api\/v1\/me\/reports\//);
  assert.match(errors.join("\n"), /missing live coverage marker: Напоминания/);
  assert.match(errors.join("\n"), /missing live coverage marker: \/api\/v1\/me\/follow-ups/);
  assert.match(errors.join("\n"), /missing live coverage marker: \/api\/v1\/me\/reminder-preferences/);
});
