# Sidebar Active-State Specificity

Date: 2026-06-10

Related commit: `d6ba6d0 Fix sidebar active navigation specificity`

## Why this exists

The sidebar is the user's main answer to "Where am I?"

Before `d6ba6d0`, the sidebar marked every URL prefix match as active. That made deep screens ambiguous:

- `/admin/governance` could make both `Операционный центр` and `Управление доступом` look active.
- `/patients/p-004/visits/v-005?tab=bodymap` could make both `Пациенты` and `Карта тела` look active.

For a dense clinical product this is not just a visual issue. It weakens orientation and makes the current task harder to understand.

## Decision

Only one sidebar item should be active: the most specific matching nav URL.

Implementation:

- strip query strings from nav URLs before matching;
- collect all matching sidebar items;
- choose the item with the longest path;
- set `data-active=true` only for that item.

Parent sections are still active when no child sidebar item matches. Example:

- `/patients/p-004` activates `Пациенты`;
- `/patients/p-004/visits/v-005?tab=bodymap` activates `Карта тела`.

## Verification contract

Automated tests cover the two regression cases:

- `/admin/governance`
  - `Управление доступом` active;
  - `Операционный центр` not active.
- `/patients/p-004/visits/v-005?tab=bodymap`
  - `Карта тела` active;
  - `Пациенты` not active.

Recommended command:

```bash
npm test -- --run src/components/shell/AppLayout.test.tsx --reporter=dot
```

## Visual verification rule

If no browser/screenshot/Lovable preview check was performed, do not claim visual acceptance.

Required wording:

```text
visual verification: not performed
reason: <why rendered visual check was not run>
Lovable checklist: <routes and expected active sidebar items>
```

## Do not regress

Do not replace the current longest-match behavior with simple prefix matching unless there is a new navigation model that still guarantees exactly one active sidebar item for deep links.

## Human-usability metric

Track:

- `ambiguous_active_nav_count`

Expected value after this decision:

- known regression cases: `0`

## Покрытие мозгового штурма

- `SD-MF-046` — Пациентский протокол / история новообразований — **частично решено**  
  Patient navigation stays clearer; patient delivery remains closed.

- `SD-MF-025` — Хронология снимков очага — **в работе**  
  Body Map deep link has a specific current-location marker; full timeline QA consolidation remains open.

- `SD-MF-026` — Режим сравнения снимков — **в работе**  
  No direct comparison workflow change; the same navigation rule protects future deep comparison routes.

- `SD-MF-028` — Достоверность анализа динамики — **в работе**  
  No clinical dynamic conclusion or medical copy change.
