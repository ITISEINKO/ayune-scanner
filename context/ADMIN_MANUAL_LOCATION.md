# Admin manual scan and panel location

Scanning on `/admin/ubah-manual` navigates in the same tab to `/admin/ubah-manual/location?barcode=<serial>`. The nested route inherits the admin layout and bottom navigation, with Scan active. Its result shows the saved LBY room first, followed by the current status and an **Ubah status barang** button opening the existing confirmation drawer. Closing the drawer retains the location; **Scan panel lain** returns to the scanner.

The admin result uses a compact full-height canvas above the bottom navigation, a neutral paper-white background in light mode, floating back/project pills, a vertical rotate/zoom toolbar and a status panel with rounded top corners. Olive theme buttons and the existing drawer confirmation remain. The removed barcode form stays removed; another panel is opened through the scanner or its barcode URL. The standalone viewer retains its regular layout and shared geometry controls.

## Read contract

`GET /api/panel/manual?serial_number=<serial>` retains its admin authorization, unique ClickUp serial lookup and existing error codes. Serials longer than 100 characters return `400 INVALID_SERIAL_NUMBER`.

The successful `{ ok: true, data }` response retains `task_id`, `nama`, `serial_number` and `status`, adding:

- `location`: `null`, or `{ projectId, projectName, version, barcode, panels }`. Only panels in the selected barcode's room are returned. An imported project without that barcode returns an empty `panels` array.
- `location_error`: `LOCATION_UNAVAILABLE` only when hierarchy resolution or snapshot reading fails. The status editor remains usable.

The project comes from the matched ClickUp task's `top_level_parent`. When absent, the server walks its parents, checking task/list identity and rejecting cycles or more than 20 visited tasks. It never searches unrelated project snapshots or accepts a client-supplied project for matching. No import exists for that project: `location: null`. No runtime LBY calls are made.

The shared `getPanelLocation` reader also serves `/panel-location`; both routes read allowlisted catalog paths. Output tracing includes snapshots for the manual API as well as the standalone viewer.

## Write contract and verification

`POST /api/panel/manual` is unchanged: fresh admin authorization, task/list and status validation, ClickUp update first, then saved component-status update. Scan and location viewing do not write status. The client keeps explicit confirmation, displays write failures, and prevents duplicate pending saves.

Local check after `npm.cmd run build`:

```powershell
postman simulation run postman/simulations/admin-dashboard.sim.yaml --port 4900 --output ndjson --no-history
# In another terminal:
node tests/admin-manual-location.cjs
node tests/panel-location.cjs
```

The simulation uses synthetic ClickUp responses and a temporary local database. The existing opt-in live test `tests/admin-manual-status.spec.ts` follows the new page/button flow, but is not part of this local check. Production deployment, real-camera scanning, live ClickUp writes and physical installation accuracy require separate verification.
