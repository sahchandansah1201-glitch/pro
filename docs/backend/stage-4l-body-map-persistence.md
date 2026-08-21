# Stage 4L-Q3 · Сохранение точек карты тела

## Результат

Рабочая карта тела сохраняет в self-hosted PostgreSQL одну запись очага с:

- проекцией `front | back | left | right | scalp`;
- относительными координатами `x/y` в диапазоне `0..1`, округлёнными до пяти знаков;
- стабильным `bodyRegionId` из versioned-манифеста;
- необязательным `bodyRegionDetailId`, который врач выбирает для пальца кисти или стопы;
- каноническим русским `bodyZone`, сформированным backend, а не свободным текстом клиента;
- `placementRevision` для защиты исправлений от незаметной конкурентной перезаписи.

Это фиксация положения очага, а не диагноз, оценка риска, прогноз или лечебная рекомендация.

## Контракт записи

`POST /api/v1/visits/{visitId}/lesions` принимает прежний lesion payload. Если передан `bodyMap`, заголовок `Idempotency-Key` обязателен. Повтор того же payload с тем же ключом возвращает исходный очаг и `replayed: true`; другой payload с тем же ключом получает `409 idempotency_conflict`.

`PATCH /api/v1/lesions/{lesionId}` принимает `bodyMap` только вместе с `expectedPlacementRevision`. Ревизия `0` предназначена для первой точной привязки исторического очага; успешное исправление увеличивает ревизию. Устаревшая ревизия получает `409 placement_conflict`.

`DELETE /api/v1/lesions/{lesionId}` сохраняет существующую семантику мягкого архивирования. Архивные строки исключаются из списка очагов визита.

Создание точки, исправление и архивирование записывают `audit_log` в той же SQL-транзакции. В audit metadata нет координат, текста пациента, снимков, путей хранения или клинического вывода — только тип изменения, ID области, проекция и ревизия.

## RBAC и границы

- Писать могут только `doctor` и `system_admin` в разрешённом clinic scope.
- `clinic_admin`, `assistant`, `operator` и пользователь без clinic scope получают отказ.
- Backend проверяет существование `bodyRegionId`, соответствие проекции, диапазон координат и допустимость `detailId`.
- Конкретный палец не определяется автоматически: его выбирает и подтверждает врач.
- Текущий реестр использует `terminologyStatus: technical_review_required`; врачебная/анатомическая приёмка границ остаётся отдельным gate.

## Миграция и откат приложения

Миграция `0094_stage4l_body_map_persistence.sql` только добавляет nullable-поля, ограничения и индексы. Исторические очаги остаются валидными с `placementRevision = 0` и без `mapPoint`.

Безопасный откат приложения: вернуть предыдущий backend/frontend HEAD, не удаляя новые колонки. Старый код продолжит читать прежние поля очага, а сохранённые координаты останутся в базе для последующего возврата версии. Физическое удаление колонок не входит в автоматический rollback и требует отдельной авторизации, резервной копии и проверки отсутствия новых данных.

## Проверка

- unit: registry/view/coordinate/detail validation;
- repository: SQL scope, idempotency replay/conflict, optimistic revision conflict, transaction-coupled audit;
- route: header propagation, `201` create, `200` replay, CORS header;
- frontend API: DTO round trip и `Idempotency-Key`;
- UI: production create, doctor-confirmed digit, correction with revision, safe retry copy;
- migration runner: migration included and schema columns/index verified.

## Последующий контракт Q4

Gate `Stage 4L-Q4` дополняет эту схему серверной проверкой источника, профиля и
попадания точки внутрь области. Точный delta, совместимость и границы описаны в
`docs/backend/stage-4l-atlas-source-geometry-contract.md`.
