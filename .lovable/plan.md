# Read-only audit · Russian interface language and usability

Status: partial source audit. Not human acceptance. No "80% achieved" claim.

## 1. Observed identity and scope

| Field | Expected | Observed | Result |
|---|---|---|---|
| Lovable project | 42e0f0ca-8217-46d1-bcd8-bfc131ce336c | same (git remote) | MATCH |
| GitHub repo | sahchandansah1201-glitch/pro | not visible from sandbox | NOT_OBSERVED |
| Active branch | codex/safe-integration-gate-20260824 | edit/edt-2d4a11cf-… | MISMATCH |
| Visible HEAD | 31f80ef54b3df630bdfd32192957157d3eadc6cd | 7dd88512be94268b53c5d55063b2a396d1d0b401 | MISMATCH |

- The expected commit exists as `origin/codex/safe-integration-gate-20260824`. It is not an ancestor of the active HEAD. The two differ in 299 files (+7820/−1353).
- Nothing was switched or changed. Source was read from the expected commit with read-only `git show` / `git grep`.
- The preview runs the active HEAD, not the expected commit. **Rendered inspection: not performed for the expected SHA.** All screens and states count as not checked visually.
- The six unpublished local body-map files (+320/−55) are outside this snapshot and were not audited.
- Sample: sidebar, access map, patients list, visit workspace and live actions, imaging tab, capture, body atlas, release status, plus a cross-repo grep. Other routes are inventoried by source only.

## 2. Coverage ledger

| Role | Routes (from access map + sidebar) | Source | Rendered | Missing evidence |
|---|---|---|---|---|
| Doctor / private doctor | /cockpit, /desk, /patients, /visits, /reports, visit, lesion, /capture; /practice only for private doctor | partial (patients, visit, imaging, capture) | not checked | all states at 1280 and 390 |
| Assistant | /capture, /patients, body-map link | partial (capture) | not checked | capture queue, recapture, offline |
| Clinic admin | /admin/*, /visits, /patients, /operator | grep only | not checked | create/edit/archive dialogs |
| Operator | /operator, /operator/booking-requests, /operator/dialogs/:id | grep only | not checked | escalation, empty queue |
| System admin | /sys/*, plus /admin/clinics, /admin/doctors | partial (release status) | not checked | key rotation, export log |
| Patient | /me/*, /bot-sim/miniapp | grep only | not checked | all |
| Shared/public | /login, /self-hosted/login, /analysis/:token, /bot-sim, /help, 404 | partial (login) | not checked | token states |

Discovered navigation detail: the sidebar link "Карта тела" for doctors and assistants points to one fixed demo visit (`/patients/p-004/visits/v-005?tab=bodymap`). This is a navigation defect, not a wording defect.

## 3. Findings (source evidence, expected commit)

| ID | Pri | Role | Location | Current phrase | Difficulty | Proposed | Clinical review |
|---|---|---|---|---|---|---|---|
| RU-01 | P0 | Doctor | VisitWorkspacePage.tsx ~2889–4204 | Fields such as «Откат», «Тренировки отката», «Слепая выборка», «Реестр», «Открытые повторы», «Период отката» | Release-control panels sit on the clinical visit screen. Staff can't tell if these need action | Move out of the doctor visit screen (layout/scope defect). If it must stay: one collapsed block «Служебная проверка (действий врача не требуется)» | Not clinical; product owner decision |
| RU-02 | P0 | Doctor | VisitWorkspaceLiveActions.tsx:2995 | «Архивировать сверку»; result «Операция контроля выполнена локально.» | Unclear object and effect | «Убрать сверку в архив» / «Сверка перенесена в архив на этом компьютере. В системе клиники не изменилась.» (only if confirmed) | Effect must be confirmed in code |
| RU-03 | P0 | Doctor | VisitWorkspaceLiveActions.tsx:1483 | «Архивировать» (lesion, destructive) | No object; no confirmation found in sample | «Убрать очаг в архив» + confirmation dialog naming the lesion | Archive consequence needs owner confirmation |
| RU-04 | P1 | Doctor | PatientsPage.tsx:1416 | «…будет архивирован в системе клиники. Физическое удаление не выполняется.» | «Физическое удаление» is technical | «Пациент … будет перенесён в архив. Данные не удаляются. Карточку можно найти в архиве.» (last sentence only if restore exists) | No |
| RU-05 | P1 | Doctor | PatientsPage.tsx:276–282 | «Система клиники не вернула описание ошибки.»; validation shown as `${field}: ${message}` | No recovery step; raw field keys may appear | «Не удалось выполнить действие. Повторите попытку. Если ошибка повторится, сообщите администратору клиники.»; map field keys to Russian labels | No |
| RU-06 | P1 | Doctor | PatientsPage.tsx:360,511,613 | «Не удалось загрузить пациентов из системы клиники: …» | Recovery missing | Add «Обновите страницу или войдите снова.» per status | No |
| RU-07 | P1 | Doctor | VisitImagingTab.tsx:1790–1799 | «Не удалось загрузить снимки.», «Не удалось подготовить ссылку.» | No next action | «Не удалось загрузить снимки. Нажмите «Обновить список снимков».» | No |
| RU-08 | P1 | All | Many lists | «Открыть» (bare) | Ambiguous in dense tables for screen readers | «Открыть визит», «Открыть отчёт», «Открыть обращение» (or aria-label with object) | No |
| RU-09 | P1 | Sys admin, doctor | AppSidebar.tsx:153; SelfHostedLoginPage.tsx:27; AdminAnalyticsPage.tsx:1266 | «Рабочий контур», «Вход в систему клиники через рабочий контур клиники.», «Финансовый контур» | «Контур» is jargon; repeated word | «Сервер клиники»; «Вход в систему клиники.»; «Финансы по филиалам» | No |
| RU-10 | P2 | Admin, doctor | AdminGovernancePage:689, VisitWorkspacePage:1885,2030,4203, SysReleaseStatusPage:2286, CapturePage:133 | «Готово» used for status, step, filter option and photo quality | Same word, different meanings | Photo: «Качество подходит»; queue: «Готово к проверке»; release: «Можно публиковать» | Photo-quality wording: reviewer |
| RU-11 | P2 | Sys admin | SysReleaseStatusPage | «Рабочее дерево», «Код версии», «Проверка предпросмотра» | Developer terms | «Состояние файлов», «Номер версии», «Проверка тестовой версии» | No |
| RU-12 | P2 | Doctor/assistant | CapturePage.tsx:43 | «недоступен» (device) | No next step | «Устройство не на связи. Проверьте подключение кабеля и программу связи.» | No |
| RU-13 | P2 | Doctor/assistant | CapturePage.tsx:958 | placeholder «—» | Empty dropdown gives no hint | «Выберите очаг» (exact object per field to be confirmed) | No |
| RU-14 | P2 | Doctor | PatientsPage.tsx:1099 | «Рабочий режим не показывает учебные данные.» | Mode terminology is unexplained | «Система клиники недоступна. Список пациентов появится после подключения.» | No |

Positive evidence: imaging toolbar icon buttons have Russian accessible names («Уменьшить», «Увеличить», «Сбросить масштаб», upload/retry/cancel queue). Upload errors name the failed file.

## 4. Terminology map and repair batches

| Concept | Variants found | Proposed single term |
|---|---|---|
| Clinic server | «система клиники», «рабочий контур», «рабочий режим» | «система клиники» |
| Archive action | «Архивировать», «Архив», «в архиве», «Скрыть на этом экране» | action «Убрать в архив»; state «В архиве» |
| Ready | «Готово», «Готовы», «Откат готов» | split by context (RU-10) |
| Photo | «снимок», «фото», «изображение» | «снимок» in doctor UI, «фото» in patient/bot UI |
| Hand-off | «Передача выше», «Переданы выше» | «Передано старшему врачу» (if that is the meaning — owner confirm) |

Batches (wording only):
1. Destructive actions and confirmations (RU-02, RU-03, RU-04).
2. Errors with recovery steps (RU-05, RU-06, RU-07, RU-12).
3. Jargon removal (RU-09, RU-11, RU-14).
4. Term consistency and specific buttons (RU-08, RU-10, RU-13).

Separate, not wording: release-control panels on the visit screen (RU-01); fixed demo body-map link in sidebar; missing lesion-archive confirmation (if confirmed).

## 5. Medical-copy review (sample only)

- Unsupported diagnosis/risk/prognosis/treatment claims found in sample: 0.
- Patient-facing claims inspected: 0 (patient routes not read in detail; not checked).
- Required clinical decisions: photo-quality term (RU-10), meaning of «Передача выше». No new medical claims proposed. Atlas terms (114) and region boundaries (56) untouched.

## 6. Counts (inspected sample only)

| Metric | Count |
|---|---|
| Ambiguous controls | 6 (bare «Открыть» group, two «Архивировать», «Архивировать сверку», «—», «Готово» group) |
| Errors without recovery | 6 |
| Unexplained jargon | 9+ (contour terms, rollout/rollback fields, dev terms) |
| Inconsistent terms | 4 concept groups |
| Unsafe medical copy | 0 found |
| Controls without accessible name | 0 found in sample |
| Unverified screens (rendered) | all 41 routes |

## 7. Highest-impact before/after

- «Архивировать» → «Убрать очаг в архив» + confirmation.
- «Физическое удаление не выполняется.» → «Данные не удаляются.»
- «Не удалось загрузить снимки.» → «Не удалось загрузить снимки. Нажмите «Обновить список снимков».»
- «Рабочий контур» → «Сервер клиники».
- «Тренировки отката» on the visit screen → remove from the doctor screen.

## 8. Brainstorm coverage

- SD-MF-047 clinical UX/copy: in progress.
- SD-MF-048 human acceptance: not performed.
- SD-MF-046 anatomy/clinical review: unchanged.

## Missing information

- GitHub repo identity is not visible from the sandbox.
- A rendered audit needs the expected commit in the preview. That needs a branch switch, which was not allowed.
- Owner decisions needed for RU-01, RU-02 and the meaning of «Передача выше».
