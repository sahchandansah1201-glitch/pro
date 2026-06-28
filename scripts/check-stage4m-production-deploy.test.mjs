import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { collectStage4MChecks, validateLiveE2EContract } from "./check-stage4m-production-deploy.mjs";

test("Stage 4M production deployment guard passes on repository files", () => {
  const result = collectStage4MChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 37);
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

  assert.match(errors.join("\n"), /uses direct page\.getByRole\("link"\); use a live helper/);
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

  assert.match(errors.join("\n"), /uses direct page\.getByRole\("link"\); use a live helper/);
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
      '"live-doctor-desk-desktop-1280.png";',
      '"live-doctor-desk-mobile-390.png";',
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
});

test("Stage 4M guard requires live patient portal coverage", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-live-patient-contract-"));
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
      '"live-doctor-desk-desktop-1280.png";',
      '"live-doctor-desk-mobile-390.png";',
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
      '"/api/v1/me/portal";',
      '"/api/v1/me/history";',
      '"live-patient-home-desktop-1280.png";',
      '"live-patient-home-mobile-390.png";',
      '"live-patient-history-desktop-1280.png";',
    ].join("\n"),
  );

  const errors = [];
  validateLiveE2EContract(errors, root);

  assert.match(errors.join("\n"), /missing live coverage marker: Запись на приём/);
});
