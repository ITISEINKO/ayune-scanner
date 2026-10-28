# ADMIN LBY import

On `/admin/profile`, **Import model LBY** opens `LbyImportDialog.tsx` for the exact `ADMIN` role. The project detail ID is an ordinary badge. The API independently checks the signed session and current database role. Import and activation recheck the role before persisting their changes. No ClickUp project selection or hierarchy lookup is required.

## User flow

1. Paste the complete LBY `cadVisitor` share URL and click **Import model**. The dialog stays open and disables duplicate submission while it waits. No progress percentage is invented.
2. Success saves a candidate and displays its vendor name, panel/room counts and import time. Inspect **Preview** in a new tab before choosing **Aktifkan**.
3. Activation changes one LBY order's active reference. Older versions remain available for rollback. A new URL is submitted through the same form; identical viewer data reuses the original revision/import time. All saved imports are available in the profile dialog, identified by order ID and a sample serial; vendor names are descriptive only.
4. Invalid/expired links, vendor errors, failed mapping/checksums, oversize data and request conflicts display an error. Failed imports do not replace the active model. On a lost response or timeout, reopen the dialog to check saved candidates before retrying.

New sources use `lby-<orderId>` as their storage key. A matching existing import or bundled order keeps its previous key and revision history. Existing order associations cannot be replaced with a different order. Concurrent activation uses the expected active revision; stale attempts return a conflict instead of silently overwriting another admin.

## Persistence and reads

The existing `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` connection is reused. No Blob account, new package, production secret, cron, or worker service is required. The application lazily creates three additive tables:

- `ppic_panel_location_project`: project/order identity, active revision and a fenced 330-second import lease.
- `ppic_panel_location_revision`: immutable sanitized snapshot/mapping as gzip BLOBs, manifest/count metadata and importing actor. SHA-256 checks are preserved. No share tokens, signed vendor URLs, full raw CAD, prices or images are saved.
- `ppic_panel_location_barcode`: exact serial-to-revision index, joined against active references so candidates and superseded revisions do not participate. Existing active snapshots are backfilled on initialization; activation also indexes older candidates.

`getPanelLocation` resolves exact board/serial numbers across active imports and available bundled snapshots; leading zeroes remain intact. `/panel-location?barcode=<serial>` works without a project parameter. Explicit revision previews still require a source key and exact ADMIN access. Multiple active matches report `LOCATION_AMBIGUOUS` instead of selecting a model. Manual status lookup retains its ClickUp serial/status lookup but no longer walks parent tasks to find a location. Location conflicts leave status editing available.

`GET /api/panel/manual?serial_number=<serial>` also returns a known active LBY location when ClickUp returns no matching task: `data.task_id` and `data.status` are null, and the UI displays the location with status editing disabled. No task or status is invented. A serial absent from both sources still returns 404; ClickUp errors and duplicate task matches retain their error responses. An ambiguous/unavailable location without a ClickUp task returns an explicit error instead of a false not-found result.

Online imports never write to the deployed repository or `/tmp`. Both viewers use the saved DB active revision first; projects without one retain their bundled snapshot. Immutable revision payloads are cached, while the current active pointer is read from the DB on each request. Only the selected room is sent to the browser. Previewing an inactive revision requires the current exact `ADMIN` role. An ADMIN can also restore a project's bundled model from the dialog when one exists.

The CLI remains available and shares the same download/validation/mapping function. Its catalog activation changes the bundled fallback, not an already-active DB revision. Online DB activation requires no model rebuild/redeploy after the feature itself has been deployed.

## Vercel Hobby configuration and limits

`vercel.json` enables Fluid Compute; only `/api/admin/panel-locations` declares `maxDuration = 300`. The shared importer uses one 240-second download deadline across its requests, with panel/model lookups in parallel. The browser allows 290 seconds for the response. Waiting is bounded, and a function terminated by Vercel leaves a lease that expires automatically. No work relies on continuing after a response.

The Node runtime is pinned to `22.x` in `package.json` because ZIP validation uses native `node:zlib.crc32`. Limits: request body 24 KiB; pasted URL 20,000 characters; remote response/archive JSON 64 MiB; online sanitized viewer JSON 1 MiB; mapping JSON 8 MiB; combined compressed DB payload 1 MiB. Oversized online models must use the CLI or a separately designed storage path. API responses contain small metadata; preview/view responses contain only room geometry.

Checked 2026-10-28 against [Vercel function limits](https://vercel.com/docs/functions/limitations) and [Fluid configuration](https://vercel.com/docs/project-configuration/vercel-json#fluid): Hobby with Fluid Compute supports up to 300 seconds, and function request/response bodies are capped at 4.5 MB. These settings do not establish actual production configuration, available quotas or guaranteed vendor latency.

## API contract

`GET /api/admin/panel-locations` returns `{ ok: true, states }` for saved imports. The optional `?project=<storage key>` retains the scoped `{ ok: true, state }` response. Each state includes `projectKey`, `activeRevision`, `bundledVersion`, and saved `versions`. Each version includes project/order/name, full revision, short version, import time, checksums, panel/room counts and a sample barcode. No geometry or source URL is returned here.

`POST /api/admin/panel-locations` accepts `{ "url": "FULL_SHARE_URL" }`, derives the storage key from the order identity, returns `{ ok: true, candidate, state }`, and stages only. The optional legacy `project` key remains supported with order isolation. The source URL must be passed in the JSON body, not an endpoint query parameter or log.

`PATCH /api/admin/panel-locations` accepts `{ "project": "PROJECT_ID", "revision": "FULL_SHA256", "expectedActiveRevision": null }`. Send the current `activeRevision` instead of null on subsequent changes. A null `revision` restores a bundled model, only when that project has one. Success returns `{ ok: true, state }`.

Errors return `{ ok: false, error }`: 401 `UNAUTHORIZED`; 403 `ADMIN_REQUIRED`; 400 invalid request/project/link or `LINK_EXPIRED`; 409 `ORDER_MISMATCH`, `IMPORT_BUSY`, `IMPORT_CONFLICT`; 413 `REQUEST_TOO_LARGE` or `MODEL_TOO_LARGE`; 429 `RATE_LIMITED`; 504 `IMPORT_TIMEOUT`; 502 `IMPORT_FAILED`. Candidate lookup returns 404 `REVISION_NOT_FOUND`. Original vendor exception text is not exposed.

## Local verification

```powershell
npm.cmd run build
postman simulation run tests/lby-online.sim.yaml --port 4914 --output ndjson --no-history
# In another terminal:
node tests/lby-online.cjs
node tests/panel-location.cjs
```

The synthetic fixture waits 21 seconds for its archive to prove the dialog does not time out at 10–20 seconds. Checks cover ADMIN-only controls/API, compressed DB writes, candidate preview, active member reads, activation/rollback, idempotency, fenced import leases, stale activation, failures retaining active data and secret exclusion. `tests/lby-import.cjs` separately checks the shared total-deadline abort and CLI behavior against its port-4913 simulation. No production credentials, live import, deployment or physical device is exercised by these tests.
