# ClickUp Production Schema

This is the current ClickUp structure used by Production Scanner. Use raw UUIDs for custom-field API calls; `cf_` is only a ClickUp UI prefix.

> **Updated 2026-10-01: simplified flow.** QC, Kendala, PIC and status syncing were removed. The scanner now only finds a task by **Barcode** and moves its **Tahap Produksi** dropdown. See "Changes for the agent" at the bottom.

## Workspace hierarchy

| Level     | Name           | ID                 |
| --------- | -------------- | ------------------ |
| Workspace | ISEINKO        | `90182186539`      |
| Space     | OMI            | `1100830000000110` |
| Folder    | Produksi       | `1100830000000273` |
| List      | Produksi       | `1100830000000321` |
| List      | Laporan Harian | `1100830000000322` |

`Kendala Log` (`1100830000000327`) is **no longer used** by the scanner (it is being deleted).

## Required configuration

```env
CLICKUP_TOKEN=
CLICKUP_PRODUKSI_LIST_ID=1100830000000321
```

`CLICKUP_KENDALA_LIST_ID` is removed. The env var is required: the fallback list ID in `src/lib/produksi.ts` differs from this live workspace.

## Produksi list

Statuses: `waiting`, `cutting`, `assembly`, `sanding`, `finishing`, `final assembly`, `qc`, `packing`, `done`, `completed`.

**The scanner does NOT read or write task status anymore.** Users change status manually in ClickUp if they want. The source of truth for the production stage is the `Tahap Produksi` dropdown.

| Field            | Type            | ID                                     | Used by scanner |
| ---------------- | --------------- | -------------------------------------- | --------------- |
| Barcode          | Text            | `213fe4c2-0d5f-449f-a14b-4697d57dbfea` | Read (lookup)   |
| Tahap Produksi   | Dropdown        | `ef76056a-61db-4af0-a81c-34983b198d3b` | Read + write    |
| Progress         | Manual progress | `d8d74c67-0ebf-4b28-ac3b-1b5c58590de3` | Write           |
| Last Scan        | Date            | `cccbf19f-568f-44d9-b976-6feb18800de7` | Write           |
| Product Type     | Dropdown        | `73db8b30-dbd7-40a7-b06c-34ad0ad96e40` | Display only    |
| SKU              | Text            | `b4f8792a-97ba-42df-a891-83884f23e896` | Display only    |
| Material         | Labels          | `1cbd25e3-387c-4e41-8c25-eafaa2dfd918` | Display only    |
| Start Production | Date            | `e51f6995-5eca-4cba-b482-0c98a3a5210a` | Display only    |
| Target Selesai   | Date            | `26c99ef8-fef9-4591-971c-da1c4b64402c` | Display only    |
| Customer/Project | Text            | `5fc890a4-78ed-44c8-87fc-085f7cf4337b` | Display only    |

**Deleted fields (do not reference):** `QC Result` (`6f23f219-...`), `Kendala` (`4c59d4e9-...`), `Detail Kendala` (`55f122d2-...`), `PIC Workshop` (`71b54903-...`), `Bukti`.

Views: `Issue Tracking` (Grid), `Production Monitor` (Board), and `List View` (now **grouped by Tahap Produksi**).

## Laporan Harian list

Statuses: `DRAFT`, `SUBMITTED`, `REVIEWED`, `COMPLETED`.

| Field             | Type   | ID                                                                       |
| ----------------- | ------ | ------------------------------------------------------------------------ |
| Tanggal           | Date   | `cd0e5154-4624-4cca-9f73-b8316bae0a13`                                   |
| Total Diproses    | Number | `95240b5d-635a-4e46-bb7d-1ade4e52aaaa`                                   |
| Total Selesai     | Number | `c69dcad5-3f37-4c62-849a-6b3398500480`                                   |
| Total On Progress | Number | `dd448b85-d0c0-409f-8ea0-8937707a709b`                                   |
| Total Kendala     | Number | `ff2a6fa2-dc14-4829-9352-5e7e2095c8c1` (**obsolete**, always 0 / ignore) |

Views: `Board`, `Kalender Laporan`, and `Daftar Laporan`.

## Scanner integration

- Tasks are found by the Produksi `Barcode` field.
- A scan moves `Tahap Produksi` to the next option and updates `Progress` and `Last Scan`.
- No QC gate, no kendala, no PIC, no status change.
- Production-stage option IDs are maintained in `src/lib/produksi.ts`; list field metadata is fetched by name at runtime by `src/lib/clickup.ts`.

## ClickUp API contract

All calls use `https://api.clickup.com/api/v2` with the header `Authorization: ${CLICKUP_TOKEN}`. The token stays server-side and must never be sent to the browser.

### Data received from ClickUp

| Request                                                                 | What the app receives                                                                    | Why it is used                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /list/{listId}/field`                                              | `{ fields: [{ id, name, type, type_config: { options: [{ id, name, orderindex }] } }] }` | Finds fields by name and resolves Tahap Produksi option UUIDs.                      |
| `GET /list/{produksiListId}/task?include_closed=true&custom_fields=...` | `{ tasks: [{ id, name, custom_fields, ... }] }`                                          | Finds exactly one Produksi task by Barcode.                                         |
| `GET /task/{taskId}`                                                    | `{ id, name, list, custom_fields, ... }`                                                 | Reads current Tahap Produksi / Progress and validates the task belongs to Produksi. |

Barcode lookup is a query parameter, not a JSON body:

```text
custom_fields=[{"field_id":"213fe4c2-0d5f-449f-a14b-4697d57dbfea","operator":"=","value":"DUMMY-002"}]
```

`Tahap Produksi` is a dropdown. Its `custom_fields[].value` may be an option UUID or an option index. Resolve it against `type_config.options` before deciding the next stage.

### Requests sent to ClickUp

| Request                                               | Body sent by the app                                            | Purpose                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `POST /task/{taskId}/field/{TAHAP_PRODUKSI_FIELD_ID}` | `{ "value": "<next-option-uuid>" }`                             | Moves to the next stage. Must be the option UUID or index, never the label. |
| `POST /task/{taskId}/field/{LAST_SCAN_FIELD_ID}`      | `{ "value": 1760000000000, "value_options": { "time": true } }` | Scan timestamp in epoch ms.                                                 |
| `POST /task/{taskId}/field/{PROGRESS_FIELD_ID}`       | `{ "value": { "current": 50 } }`                                | Manual progress.                                                            |
| `POST /task/{taskId}/comment`                         | `{ "comment_text": "[SCAN] ...", "notify_all": false }`         | Audit entry per scan.                                                       |
| `POST /task/{taskId}/attachment`                      | Multipart `attachment` image                                    | Optional photo evidence on advance (native task attachment).                |

### Application API used by the scanner

The browser never calls ClickUp directly.

| Local request                 | Browser sends                                     | Browser receives on success                                                     |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /api/produksi/{barcode}` | Barcode in URL                                    | `{ ok: true, data: { taskId, nama, barcode, tahapSekarang, tahapBerikutnya } }` |
| `POST /api/produksi/scan`     | `{ "barcode": "DUMMY-002", "action": "advance" }` | `{ task_id, nama, barcode, from, to, progress, last_scan }`                     |
| `POST /api/produksi/advance`  | `FormData`: `task_id`, optional `attachment`      | `{ from, to, last_scan }`                                                       |

A successful stage update writes the new dropdown UUID first; if that fails, return `CLICKUP_STAGE_UPDATE_FAILED` and log ClickUp's response body. If the task is already at the last Tahap Produksi option, return `409 ALREADY_FINAL_STAGE`.

Example Produksi task IDs: `z96buhr9e1`, `z96buhr9e2`, `z96buhr9e3`.

---

## Changes for the agent (what to update in code)

1. **Remove status sync:** delete the `PUT /task/{taskId}` `{ status }` call and the stage â†’ status mapping in `src/lib/produksi.ts`.
2. **Remove QC:** delete the `QC_RESULT_FIELD_ID` constant, QC option IDs, `isQcStage`, the `qc_pass` FormData param, and the `409 QC_ACTION_REQUIRED` branch. `qc` is now just a normal Tahap Produksi option.
3. **Remove kendala:** delete the `POST /api/produksi/{barcode}/kendala` route, `CLICKUP_KENDALA_LIST_ID`, the Kendala Log fetch, the `409 OPEN_KENDALA` check, and all code for the `Kendala`, `Detail Kendala`, `Produksi Task`, `Jenis Kendala`, `Tahap Saat Kendala`, and `PIC` fields.
4. **Remove PIC:** delete `PIC Workshop` handling.
5. **Remove `actions`/`isQcStage`** from the `GET /api/produksi/{barcode}` response and the matching UI buttons (kendala form, QC pass/fail).
6. **Field lookup by name** in `src/lib/clickup.ts` must not throw if a deleted field (QC Result, Kendala, etc.) is missing.
7. Remove `CLICKUP_KENDALA_LIST_ID` from `.env.example` and any config validation.
