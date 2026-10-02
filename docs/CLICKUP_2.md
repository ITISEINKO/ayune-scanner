# ClickUp Production Schema

This is the current ClickUp structure used by Production Scanner. Use raw UUIDs for custom-field API calls; `cf_` is only a ClickUp UI prefix.

> **Updated 2026-10-01: final scope.** QC, Kendala and PIC are removed. The scanner finds a task by **Barcode** and on each scan writes, in this order:
>
> 1. `Tahap Produksi` â†’ next option (**source of truth**)
> 2. Task **status** â†’ mapped from the new tahap (`TAHAP_TO_STATUS`)
> 3. `Progress` and `Last Scan`
> 4. `Start Production` â†’ only on the first scan, if empty
> 5. A `[SCAN]` audit comment
>
> The same flow applies to both `/autoscan` and the homepage `StatusChange`. See "Changes for the agent" at the bottom.

## Workspace hierarchy

| Level     | Name           | ID                 |
| --------- | -------------- | ------------------ |
| Workspace | ISEINKO        | `90182186539`      |
| Space     | OMI            | `1100830000000110` |
| Folder    | Produksi       | `1100830000000273` |
| List      | Produksi       | `1100830000000321` |
| List      | Laporan Harian | `1100830000000322` |

`Kendala Log` (`1100830000000327`) is **no longer used** by the scanner.

## Required configuration

```env
CLICKUP_TOKEN=
CLICKUP_PRODUKSI_LIST_ID=1100830000000321
```

`CLICKUP_KENDALA_LIST_ID` is removed. The env var is required: the fallback list ID in `src/lib/produksi.ts` differs from this live workspace.

## Produksi list

Statuses: `waiting`, `cutting`, `assembly`, `sanding`, `finishing`, `final assembly`, `qc`, `packing`, `done`, `completed`.

`Tahap Produksi` is the source of truth. **Status is derived from Tahap Produksi** and must never be set independently by the scanner.

### Tahap Produksi â†’ Status mapping

Option order (dropdown `orderindex`) is the production order. Match options **by name** at runtime (resolve UUID via `GET /list/{id}/field`).

| #   | Tahap Produksi      | Status           |
| --- | ------------------- | ---------------- |
| 0   | Handover Produksi   | `waiting`        |
| 1   | Persiapan Material  | `waiting`        |
| 2   | QC Material         | `qc`             |
| 3   | Pelapisan Bahan     | `cutting`        |
| 4   | Marking & Cutting   | `cutting`        |
| 5   | QC Hasil Potong     | `qc`             |
| 6   | Edging              | `assembly`       |
| 7   | Drilling            | `assembly`       |
| 8   | Finishing Pelapisan | `finishing`      |
| 9   | QC3 - QC WS         | `qc`             |
| 10  | Komplain            | `qc`             |
| 11  | QC4 - QC Assembly   | `qc`             |
| 12  | Dis-assembling      | `final assembly` |
| 13  | Packing             | `packing`        |
| 14  | Pengiriman          | `done`           |

Notes:

- `sanding` is currently unused by any tahap. `completed` is set manually (e.g. after delivery confirmed); the scanner never sets it.
- If a tahap is not found in the map, **leave the status unchanged** and log a warning.
- QC tahaps are normal stages now (no pass/fail gate); the scan just advances.

Suggested code shape (`src/lib/produksi.ts`):

```ts
export const TAHAP_TO_STATUS: Record<string, string> = {
	"Handover Produksi": "waiting",
	"Persiapan Material": "waiting",
	"QC Material": "qc",
	"Pelapisan Bahan": "cutting",
	"Marking & Cutting": "cutting",
	"QC Hasil Potong": "qc",
	Edging: "assembly",
	Drilling: "assembly",
	"Finishing Pelapisan": "finishing",
	"QC3 - QC WS": "qc",
	Komplain: "qc",
	"QC4 - QC Assembly": "qc",
	"Dis-assembling": "final assembly",
	Packing: "packing",
	Pengiriman: "done",
};
```

### Fields

| Field            | Type            | ID                                     | Used by scanner                     |
| ---------------- | --------------- | -------------------------------------- | ----------------------------------- |
| Barcode          | Text            | `213fe4c2-0d5f-449f-a14b-4697d57dbfea` | Read (lookup)                       |
| Tahap Produksi   | Dropdown        | `ef76056a-61db-4af0-a81c-34983b198d3b` | Read + write                        |
| Progress         | Manual progress | `d8d74c67-0ebf-4b28-ac3b-1b5c58590de3` | Write                               |
| Last Scan        | Date            | `cccbf19f-568f-44d9-b976-6feb18800de7` | Write                               |
| Start Production | Date            | `e51f6995-5eca-4cba-b482-0c98a3a5210a` | Write on first scan only (if empty) |
| Product Type     | Dropdown        | `73db8b30-dbd7-40a7-b06c-34ad0ad96e40` | Display only                        |
| SKU              | Text            | `b4f8792a-97ba-42df-a891-83884f23e896` | Display only                        |
| Material         | Labels          | `1cbd25e3-387c-4e41-8c25-eafaa2dfd918` | Display only                        |
| Target Selesai   | Date            | `26c99ef8-fef9-4591-971c-da1c4b64402c` | Display only                        |
| Customer/Project | Text            | `5fc890a4-78ed-44c8-87fc-085f7cf4337b` | Display only                        |

**Deleted fields (do not reference):** `QC Result` (`6f23f219-...`), `Kendala` (`4c59d4e9-...`), `Detail Kendala` (`55f122d2-...`), `PIC Workshop` (`71b54903-...`), `Bukti`.

Views: `Issue Tracking` (Grid), `Production Monitor` (Board), and `List View` (grouped by Tahap Produksi).

## Laporan Harian list

Statuses: `DRAFT`, `SUBMITTED`, `REVIEWED`, `COMPLETED`.

| Field             | Type   | ID                                                            |
| ----------------- | ------ | ------------------------------------------------------------- |
| Tanggal           | Date   | `cd0e5154-4624-4cca-9f73-b8316bae0a13`                        |
| Total Diproses    | Number | `95240b5d-635a-4e46-bb7d-1ade4e52aaaa`                        |
| Total Selesai     | Number | `c69dcad5-3f37-4c62-849a-6b3398500480`                        |
| Total On Progress | Number | `dd448b85-d0c0-409f-8ea0-8937707a709b`                        |
| Total Kendala     | Number | `ff2a6fa2-dc14-4829-9352-5e7e2095c8c1` (**obsolete**, ignore) |

Views: `Board`, `Kalender Laporan`, and `Daftar Laporan`.

## Scanner integration

- Tasks are found by the Produksi `Barcode` field.
- A scan moves `Tahap Produksi` to the next option, sets the **status mapped from the new tahap**, updates `Progress` and `Last Scan`, sets `Start Production` if empty, and adds a `[SCAN]` comment.
- Manual tahap changes in the ClickUp UI are synced to status by **ClickUp Automations** (see below), not by the app.
- No QC gate, no kendala, no PIC.

### Manual changes in ClickUp (Automations, configured in UI, not code)

On the Produksi list, create Automations: **Trigger** "Custom Field changes â†’ Tahap Produksi â†’ to `<option>`", **Action** "Change status â†’ `<mapped status>`", one per row in the mapping table. This keeps status correct when a user edits Tahap Produksi by hand.

The app also sets status itself after a scan, so it doesn't depend on Automations; both writing the same value is harmless.

## ClickUp API contract

All calls use `https://api.clickup.com/api/v2` with the header `Authorization: ${CLICKUP_TOKEN}`. The token stays server-side and must never be sent to the browser.

### Data received from ClickUp

| Request                                                                 | What the app receives                                                                    | Why it is used                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /list/{listId}/field`                                              | `{ fields: [{ id, name, type, type_config: { options: [{ id, name, orderindex }] } }] }` | Finds fields by name and resolves Tahap Produksi option UUIDs/names.                                   |
| `GET /list/{produksiListId}/task?include_closed=true&custom_fields=...` | `{ tasks: [{ id, name, status, custom_fields, ... }] }`                                  | Finds exactly one Produksi task by Barcode.                                                            |
| `GET /task/{taskId}`                                                    | `{ id, name, list, status, custom_fields, ... }`                                         | Reads current Tahap Produksi / Progress / Start Production and validates the task belongs to Produksi. |

Barcode lookup is a query parameter, not a JSON body:

```text
custom_fields=[{"field_id":"213fe4c2-0d5f-449f-a14b-4697d57dbfea","operator":"=","value":"DUMMY-002"}]
```

`Tahap Produksi` is a dropdown. Its `custom_fields[].value` may be an option UUID or an option index. Resolve it against `type_config.options` before deciding the next stage.

### Requests sent to ClickUp (in order)

| #   | Request                                                 | Body sent by the app                                                                   | Purpose                                                                     |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `POST /task/{taskId}/field/{TAHAP_PRODUKSI_FIELD_ID}`   | `{ "value": "<next-option-uuid>" }`                                                    | Moves to the next stage. Must be the option UUID or index, never the label. |
| 2   | `PUT /task/{taskId}`                                    | `{ "status": "<TAHAP_TO_STATUS[nextTahapName]>" }`                                     | Syncs status from the new tahap. Only after #1 succeeds.                    |
| 3   | `POST /task/{taskId}/field/{PROGRESS_FIELD_ID}`         | `{ "value": { "current": 50 } }`                                                       | Manual progress.                                                            |
| 3   | `POST /task/{taskId}/field/{LAST_SCAN_FIELD_ID}`        | `{ "value": 1760000000000, "value_options": { "time": true } }`                        | Scan timestamp in epoch ms.                                                 |
| 4   | `POST /task/{taskId}/field/{START_PRODUCTION_FIELD_ID}` | `{ "value": 1760000000000, "value_options": { "time": true } }`                        | Only on first scan when the field is empty.                                 |
| 5   | `POST /task/{taskId}/comment`                           | `{ "comment_text": "[SCAN] <from> â†’ <to> (status: <status>)", "notify_all": false }` | Audit entry per scan.                                                       |
| opt | `POST /task/{taskId}/attachment`                        | Multipart `attachment` image                                                           | Optional photo evidence on advance (native task attachment).                |

### Application API used by the scanner

The browser never calls ClickUp directly.

| Local request                 | Browser sends                                     | Browser receives on success                                                             |
| ----------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/produksi/{barcode}` | Barcode in URL                                    | `{ ok: true, data: { taskId, nama, barcode, tahapSekarang, tahapBerikutnya, status } }` |
| `POST /api/produksi/scan`     | `{ "barcode": "DUMMY-002", "action": "advance" }` | `{ task_id, nama, barcode, from, to, status, status_sync, progress, last_scan }`        |
| `POST /api/produksi/advance`  | `FormData`: `task_id`, optional `attachment`      | `{ from, to, status, status_sync, last_scan }`                                          |

Error handling:

- Tahap write (#1) fails â†’ `CLICKUP_STAGE_UPDATE_FAILED` (log ClickUp's response body). Do not run #2â€“#5.
- Tahap OK but any of #2â€“#5 fails â†’ still return success (tahap is the source of truth); set `status_sync: false` if #2 failed, and log the failure.
- Task already at the last option (`Pengiriman`) â†’ `409 ALREADY_FINAL_STAGE`.

Example Produksi task IDs: `z96buhr9e1`, `z96buhr9e2`, `z96buhr9e3`.

---

## Changes for the agent (what to update in code)

1. **Replace status mapping:** remove the old stage â†’ status mapping and add `TAHAP_TO_STATUS` (above) in `src/lib/produksi.ts`. After a successful Tahap Produksi write, call `PUT /task/{taskId}` with the mapped status. Unknown tahap â†’ skip status update + warn.
2. **Keep** Progress, Last Scan, Start Production (first scan only) and the `[SCAN]` comment.
3. **Remove QC:** delete the `QC_RESULT_FIELD_ID` constant, QC option IDs, `isQcStage`, the `qc_pass` FormData param, and the `409 QC_ACTION_REQUIRED` branch. QC tahaps are now normal stages.
4. **Remove kendala:** delete the `POST /api/produksi/{barcode}/kendala` route, `CLICKUP_KENDALA_LIST_ID`, the Kendala Log fetch, the `409 OPEN_KENDALA` check, and all code for `Kendala`, `Detail Kendala`, `Produksi Task`, `Jenis Kendala`, `Tahap Saat Kendala`, and `PIC` fields.
5. **Remove PIC:** delete `PIC Workshop` handling.
6. **API responses:** drop `actions`/`isQcStage`, add `status` and `status_sync`. Remove kendala form and QC pass/fail buttons in the UI.
7. **Field lookup by name** in `src/lib/clickup.ts` must not throw if a deleted field (QC Result, Kendala, etc.) is missing.
8. Remove `CLICKUP_KENDALA_LIST_ID` from `.env.example` and config validation.
9. **One shared helper** for the scan flow, used by both `/autoscan` and homepage `StatusChange`, so they can't drift.
