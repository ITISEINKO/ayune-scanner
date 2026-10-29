# Shared ongoing project detail

`/admin/project?task_id=...` displays the saved project dashboard immediately after
checking a signed session, login-token cookie and the viewer's current local
`SUPER_ADMIN` role. Login identity remains necessary for authorization; it does not
select an ongoing project's data source or snapshot.

## Source and storage

Ongoing snapshots in `ppic_admin_project_snapshot` use SHA-256 of
`[server CLICKUP_TOKEN, panelListId(), task_id]`. Every authorized admin, Home summary
and scheduled prewarm reuses that same row and its existing 60-second refresh lease.
The server account's older matching rows remain reusable. Older browser-token rows
are retained but no longer selected for ongoing data; credentials are not stored
in JSON. The first shared read without a saved row builds one.

Cold/forced builds use the server token and require its owner to have the current
local `SUPER_ADMIN` role. They validate the parent task/panel list and fetch all
descendant pages before saving. Failed builds retain the saved snapshot. Concurrent
cold/forced builds cannot take the same active lease. The existing local-status
overlay protects scans recorded during a rebuild.

Completed reviews, completion mutations/attribution and their frozen archive scopes
retain their existing behavior. Member scanning and project selection are unchanged.

## API contract

Both methods require signed identity, a login-token cookie and fresh local admin
authorization, including cache hits. They return `{ ok: true, dashboard }`, using
the existing `ProjectDashboard` type, with `Cache-Control: no-store`.

| Request | Behavior |
| --- | --- |
| `GET /api/project/sync?task_id=<project>` | Reads the shared saved snapshot plus newer local statuses. Builds once if absent. No age-based ClickUp rebuild. |
| `POST /api/project/sync` with `{ "task_id": "<project>" }` | Explicit Resync: rebuilds from ClickUp with the server account and publishes the result for all admins. |
| `GET /api/project/changes?project=<project>&since=<timestamp>` | Existing database-only status deltas, now also checking the current local admin role. |

Sync errors: 400 `INVALID_PROJECT` for missing/blank/non-string IDs or malformed JSON;
401 `UNAUTHORIZED` for missing signed identity/login token; 403 `FORBIDDEN` for a
non-admin or revoked viewer; 404 `PROJECT_NOT_AVAILABLE` for an invalid parent/list;
409 `PROJECT_SYNC_IN_PROGRESS` or `PROJECT_SYNC_SUPERSEDED` for lease conflicts;
429 `RATE_LIMITED` for ClickUp throttling; otherwise 502 `PROJECT_SYNC_FAILED`.
The delta endpoint retains its `INVALID_REQUEST` parameter validation.

## Open-page updates

The existing adaptive database-status poll remains (initially 10 seconds, 5 seconds
after changes, backing off to 60 seconds). That same timer checks the full shared
snapshot about every five minutes, so a check may run up to 60 seconds later. Hidden
tabs make no polling requests; returning checks immediately if due. In-flight work
does not overlap and is aborted on unmount or snapshot replacement.

A Resync/prewarm published by another admin appears on the next successful snapshot
check without navigation, keeping displayed data while waiting or after failure.
Snapshot failures are retried after five minutes; status polling continues in the
meantime. History/metadata/structure remain those of the last successful shared build;
the background read itself does not fetch them from ClickUp again.

Local checks: `npm.cmd test`, `npm.cmd run test:api` against the existing Postman
simulation, `npm.cmd run build`, `node --experimental-strip-types
tests/admin-project-groups.cjs`, and the Home/completion browser regressions. Browser
clock/visibility and synthetic credentials are used for the five-minute behavior;
these checks do not establish production latency, quotas or deployment behavior.
