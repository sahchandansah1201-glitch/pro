# UX Batch 8 · Operator Native Russian UI Verification

Verify the synced commit for UX Batch 8. This is verification-only: do not implement new features.

## Expected scope

Only these areas should be affected:

- `src/components/shell/AppSidebar.tsx`
- `src/components/shell/AppLayout.tsx`
- `src/pages/operator/OperatorConsolePageDemo.tsx`
- `src/pages/operator/OperatorConsolePageLive.tsx`
- `src/pages/operator/OperatorBookingRequestsPageDemo.tsx`
- `src/pages/operator/OperatorBookingRequestsPageLive.tsx`
- `src/pages/operator/OperatorDialogPage.tsx`
- `src/pages/bot/BotMiniAppBookingPage.tsx`
- related focused tests

Out of scope:

- backend/API/OpenAPI/database changes
- role model changes
- patient delivery
- diagnosis/risk/prognosis/treatment claims
- medical measurement values
- clinical dynamic conclusion
- tokens/QR/session/credential/storage path/signed URL exposure

## Verification checklist

1. Sync status:
   - visible HEAD is the UX Batch 8 commit;
   - no mismatch/reconnect/fallback warning.
2. Sidebar:
   - role `operator` has one `Поддержка` group only;
   - links visible: `Очередь диалогов`, `Карточка обращения`, `Справка`;
   - no duplicate React key warning for `Поддержка`.
3. `/operator`:
   - visible Russian task copy: `Центр обращений оператора`, `Очередь передачи`, `Обращение ...`, `номер скрыт`, `Заявка`;
   - no visible `Lead`, `Lead ID`, `handoff`, `CTA`, `Web`, `ID скрыт`, `MVP`, `backend`, `production`, `Stage`;
   - channel badges are human-readable: `Telegram`, `WhatsApp`, `Сайт`, not raw uppercase enum values.
4. `/operator/booking-requests`:
   - fallback/demo text is Russian: `Очередь заявок включается в рабочем режиме`;
   - live copy uses `заявка`, `система клиники`, `защищённый импорт`, not technical backend wording.
5. `/operator/dialogs/bd-001`:
   - title is `Обращение 001`;
   - channel copy says `номер скрыт`;
   - UTM values are user-readable (`Telegram`, `бот`, `проверка кожи`) rather than raw keys (`tg`, `bot`, `skincheck_q1`);
   - visible action label is `Следующее действие`, not `CTA`.
6. `/bot-sim/miniapp/booking`:
   - visible copy says `Форма записи · демо`, `Локальная заявка`, `Запись`;
   - no visible `Mini App`, `Lead ID`, `Appointment ID`, `MVP`.
7. Shared shell:
   - global search placeholder says `Поиск пациента, визита, заявки…`;
   - no visible or accessible `Self-hosted` wording in the checked operator shell.
8. Functional visibility:
   - check routes as role `operator`;
   - `/operator`, `/operator/booking-requests`, `/operator/dialogs/bd-001`, `/bot-sim/miniapp/booking` are reachable.
9. Responsive/visual:
   - run desktop 1280px and mobile 390px;
   - no horizontal overflow;
   - no clipped primary actions;
   - touch/click targets for visible buttons and links are at least 44px, except the existing sidebar icon trigger if it is outside this batch scope.
10. Hygiene:
   - no patient delivery;
   - no diagnosis/risk/prognosis/treatment;
   - no medical measurement values;
   - no clinical dynamic conclusion;
   - no token/QR/session/credential/storage path/signed URL exposure.
11. Tests:
   - focused operator/app-shell tests pass if available.

## Required report format

```text
Sync:
- connected repo:
- active branch:
- visible HEAD:
- expected commit visible:
- mismatch/reconnect/fallback warning:

Checks: X/11
1. ...

Visual verification:
- performed: yes/no
- routes:
  - /operator
  - /operator/booking-requests
  - /operator/dialogs/bd-001
  - /bot-sim/miniapp/booking
- desktop 1280px:
- mobile 390px:
- visual issues:
- screenshots:

Functional visibility:
- operator sidebar:
- primary tasks:

Hygiene:
- patient delivery:
- unsafe medical copy:
- protected fields:

Quality metrics:
- visible_english_or_technical_terms:
- duplicate_sidebar_group_warning:
- responsive_overflow_count:
- sub_44px_target_count:
- unverified_screen_count:

Покрытие мозгового штурма:
- SD-MF-025:
- SD-MF-026:
- SD-MF-028:
- SD-MF-046:

Нужна ли дополнительная синхронизация GitHub/Lovable:
```
