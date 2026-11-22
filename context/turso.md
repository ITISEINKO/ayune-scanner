# Turso persistence audit

## Connection and schema ownership

- **Confirmed:** `src/lib/db.ts` creates `@libsql/client` with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, and throws `Turso environment variables are missing` at module initialization if either is absent.
- **Confirmed:** The application creates `ppic_component_status` and `ppic_project_serial_cache` with `CREATE TABLE IF NOT EXISTS`; it conditionally adds columns to pre-existing `ppic_scan_history`. Better Auth's `user`, `account`, `session`, and `verification` tables are defined through Drizzle; permission fields are on `user`.
- **Unverified:** Production schema/migration version, indexes beyond the named component-status index, backups, retention, and Turso transaction/isolation settings are not confirmed here. `ppic_permissions` is a legacy migration source, not a runtime table dependency.

## Tables and access paths

| Table | Confirmed stored data | Readers | Writers | Relation to ClickUp |
| --- | --- | --- | --- | --- |
| `ppic_component_status` | component task ID primary key, parent project task ID, normalized PPIC status, epoch `updated_at`; index `(project_task_id, updated_at)` | dashboard overlay, delta route | dashboard seed, scan/manual update, signed webhook | local latest status keyed by ClickUp task IDs; it can override cached dashboard status. |
| `ppic_project_serial_cache` | one project ID, `complete`, JSON serial map `{ task_id, name, status_id }`, expiry | scan route | selection preload, scan miss/status update; selection deletes first | derived from ClickUp panel-list tasks; expires after eight hours. |
| Better Auth `user` + `account` | User identity/profile, role, scan statuses, active flag, LBY capability, permission updater/timestamp; `account` links the ClickUp provider ID/account ID | login/access checks, dashboard, and settings | settings route; members GET saves ClickUp display names | authorization resolves the ClickUp identity and channel membership, not task data. |
| `ppic_scan_history` | ClickUp user ID, serial, PPIC status, task name, scanned timestamp, and migrated project/component task IDs | member history and dashboard history/contribution | successful scan route | audit/history of a ClickUp status update, linked by ClickUp project/component IDs. |

## Data flows

- **Confirmed:** `buildProjectDashboard` reads ClickUp hierarchy then calls `seedPpicProjectStatuses`, an upsert batch that refreshes every discovered component's status and timestamp. It separately reads local scan history/member names and overlays local status rows after dashboard-cache retrieval.
- **Confirmed:** `POST /api/panel/scan` writes ClickUp, then `updatePpicComponentStatus`, `savePpicScanHistory`, and `updateCachedSerialStatus` in that order.
- **Confirmed:** `POST /api/panel/manual` writes ClickUp, then only `updatePpicComponentStatus`; it does not create scan history.
- **Confirmed:** `POST /api/clickup/scan-hook` does no ClickUp call; it applies a signed external custom-field event to `ppic_component_status` only if an existing row matches.
- **Confirmed:** Settings mutations update permission fields on Better Auth `user` records, then invalidate the 60-second Next member cache; notification failure is logged but does not roll back the Turso write.

## Consistency and lifecycle limits

- **Confirmed:** Cross-system writes are separate awaited calls; no Turso transaction spans a ClickUp request.
- **Inferred:** A lost response after ClickUp accepts a status mutation, or a Turso failure immediately after it, can make the browser report failure while remote task state has changed. The next dashboard seed/webhook may repair the local status, but this recovery path is not guaranteed by code.
- **Confirmed:** `updatePpicComponentStatus` returns whether an existing row was affected; scan/manual/webhook callers do not require that result to be true. Thus a ClickUp update can succeed before a dashboard has seeded a corresponding local row.
- **Inferred:** `ppic_project_serial_cache` can become stale before its eight-hour expiry for external task moves, serial edits, or status changes not reflected through the local scan path; selection clearing/preload and cache misses reduce but do not eliminate that window.
