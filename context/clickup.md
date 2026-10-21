# ClickUp integration audit

## Shared authorization and token handling

- **Confirmed:** `src/app/api/auth/clickup/route.ts` creates a random OAuth `state`, stores it in the HttpOnly `clickup_oauth_state` cookie for 10 minutes, and redirects to the URL made by `clickUpAuthUrl`.
- **Confirmed:** `src/app/api/auth/clickup/callback/route.ts` validates `state`, exchanges the authorization code at `POST /api/v2/oauth/token`, validates `/user` and `/team`, checks `CLICKUP_TEAM_ID`, then puts the access token in an HttpOnly `clickup_access_token` cookie for nine hours.
- **Confirmed:** `clickUpHeaders` sends the cookie token as the `Authorization` header. `clickUpToken` only reads the cookie; no refresh-token exchange is implemented in the inspected code.
- **Inferred:** An expired/revoked ClickUp access token requires the current error/reauthentication path; automatic token refresh cannot be inferred from this repository.

## Reads

| Caller | ClickUp operation and input | Response use | Cache/error behavior |
| --- | --- | --- | --- |
| `clickUpUserIdForToken`, `clickUpEmail` in `src/lib/session.ts` | `GET /api/v2/user` | resolves ClickUp user ID/email for session and access checks | `clickUpUserIdForToken` is React `cache()` scoped to request render; failures yield `null`. |
| `inProgressProjects` in `src/lib/projects.ts` | paginated `GET /api/v2/list/{panelListId}/task?statuses[]=in progress&page=N` | selectable parent projects | `cache: no-store`; 60 s process `Map`; 429 becomes `RATE_LIMITED`. |
| `preloadProjectSerialCache` in `src/lib/projectSerialCache.ts` | paginated panel-list task read with subtasks/status | serial-to-task/status index for selected project | `cache: no-store`; writes eight-hour Turso cache; no retry/timeout. |
| `findSerial` in `panel/scan`, `panel/manual` GET, and `find-task` | list-task read using exact Serial Number custom-field filter; details vary by route | finds task or task URL/status | `cache: no-store`; duplicate detection exists in scan/manual, not `find-task`. |
| `fieldsByName` in `src/lib/clickup.ts` | `GET /api/v2/list/{listId}/field` | verifies status field and converts option IDs/names | 5 min process `Map`; failure is logged and returns `null`. |
| `getProjectDashboard` | `GET /task/{id}?include_subtasks=true`, `/task/{id}/time_in_status`, paginated `/team/{teamId}/task?parent={id}` | project metadata, hierarchy, component status, duration | first two Next-cache 30 s; descendants no-store plus 60 s process `Map`; dashboard has tag cache with no TTL. |
| `panelChannelMembers` | `GET /api/v3/workspaces/{workspaceId}/chat/channels/{channelId}/members` | access-settings member list | `unstable_cache`, 60 s; validates current user is a channel member. |

All rows above are **Confirmed** from the named functions. **Confirmed:** there are 19 server-side `fetch()` call sites under `src/lib` and `src/app/api`; none passes an `AbortSignal`, implements retry/backoff, or sets a client timeout. **Unverified:** provider/default platform timeouts were not measured.

## Writes

| Caller | ClickUp write | Input and local follow-up | Failure/consistency boundary |
| --- | --- | --- |
| `POST /api/panel/scan` | `POST /api/v2/task/{taskId}/field/{statusFieldId}` | validated serial, project scope, and PPIC status; then writes local status/history/cache | **Confirmed:** ClickUp is first. **Inferred:** a later Turso failure leaves a completed ClickUp update with an error response. |
| `POST /api/panel/manual` | same task custom-field POST | fresh-super-admin check, task read/list check, valid status; then `updatePpicComponentStatus` | **Confirmed:** there is no transaction/reconciliation around ClickUp plus Turso. |
| `POST /api/clickup/webhook` | `POST /api/v2/team/{teamId}/webhook` | super-admin supplied HTTPS endpoint; asks ClickUp for `taskUpdated` on panel list | **Confirmed:** this creates a remote webhook and returns ClickUp body. **Unverified:** operators use it in production. |

## Custom field and webhook behavior

- **Confirmed:** Scan writes the `STATUS BARANG SCAN` option ID defined in `src/lib/produksiPanel.ts`; environment override is `CLICKUP_FIELD_STATUS_BARANG_SCAN`.
- **Confirmed:** Serial lookup uses `CF_PANEL.SERIAL_NUMBER`; project cache additionally compares `CF_PANEL.RELATED_ORDER_NUMBER` and `taskProjectScope`.
- **Confirmed:** The webhook receiver verifies HMAC before parsing JSON; it only updates a matching existing component-status row and does not write ClickUp.
- **Inferred:** The receiver does not independently confirm webhook `team_id`/`list_id` or fetch the task, so its intended event scope relies on ClickUp webhook configuration and signature integrity.

## Failure risks and smallest safe actions

- **Confirmed:** 429 is normalized to `RATE_LIMITED` in many paths, but no path retries automatically. This avoids blind duplicate writes; it also leaves recovery manual.
- **Confirmed:** Most request failures return generic `CLICKUP_ERROR`/502; only `fieldsByName`, serial-cache preload, and Ably publish have explicit `console.error` logging.
- **Inferred:** Add per-request elapsed-time/error logging with redacted route and ClickUp status before adding retries. It is the smallest way to establish whether slow lists, provider faults, or cache misses dominate.
