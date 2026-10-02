# ClickUp Production Schema

This is the current ClickUp structure used by Production Scanner. Use raw UUIDs for custom-field API calls; `cf_` is only a ClickUp UI prefix.

## Workspace hierarchy

| Level | Name | ID |
| --- | --- | --- |
| Workspace | ISEINKO | `90182186539` |
| Space | OMI | `1100830000000110` |
| Folder | Produksi | `1100830000000273` |
| List | Produksi | `1100830000000321` |
| List | Laporan Harian | `1100830000000322` |
| List | Kendala Log | `1100830000000327` |

## Required configuration

```env
CLICKUP_TOKEN=
CLICKUP_PRODUKSI_LIST_ID=1100830000000321
CLICKUP_KENDALA_LIST_ID=1100830000000327
```

The environment variables are required: the fallback list IDs in `src/lib/produksi.ts` differ from this live workspace.

## Produksi list

Statuses: `waiting`, `cutting`, `assembly`, `sanding`, `finishing`, `final assembly`, `qc`, `packing`, `done`, `completed`.

| Field | Type | ID |
| --- | --- | --- |
| Barcode | Text | `213fe4c2-0d5f-449f-a14b-4697d57dbfea` |
| PIC Workshop | People | `71b54903-3cec-4ae5-ac8a-b0e88e5f8a12` |
| Product Type | Dropdown | `73db8b30-dbd7-40a7-b06c-34ad0ad96e40` |
| SKU | Text | `b4f8792a-97ba-42df-a891-83884f23e896` |
| Material | Labels | `1cbd25e3-387c-4e41-8c25-eafaa2dfd918` |
| Progress | Manual progress | `d8d74c67-0ebf-4b28-ac3b-1b5c58590de3` |
| Start Production | Date | `e51f6995-5eca-4cba-b482-0c98a3a5210a` |
| Target Selesai | Date | `26c99ef8-fef9-4591-971c-da1c4b64402c` |
| Tahap Produksi | Dropdown | `ef76056a-61db-4af0-a81c-34983b198d3b` |
| Last Scan | Date | `cccbf19f-568f-44d9-b976-6feb18800de7` |
| QC Result | Dropdown | `6f23f219-18fd-4362-a426-311eb8175e9d` |
| Kendala | Dropdown | `4c59d4e9-7163-4e4a-9c6e-41cbf2e911ff` |
| Detail Kendala | Shared custom field | `55f122d2-ebdb-4a9f-9b3a-62c0c4ab2390` |

Views: `Issue Tracking` (Grid), `Production Monitor` (Board), and `List View`.

## Laporan Harian list

Statuses: `DRAFT`, `SUBMITTED`, `REVIEWED`, `COMPLETED`.

| Field | Type | ID |
| --- | --- | --- |
| Tanggal | Date | `cd0e5154-4624-4cca-9f73-b8316bae0a13` |
| Total Diproses | Number | `95240b5d-635a-4e46-bb7d-1ade4e52aaaa` |
| Total Selesai | Number | `c69dcad5-3f37-4c62-849a-6b3398500480` |
| Total On Progress | Number | `dd448b85-d0c0-409f-8ea0-8937707a709b` |
| Total Kendala | Number | `ff2a6fa2-dc14-4829-9352-5e7e2095c8c1` |

Views: `Board`, `Kalender Laporan`, and `Daftar Laporan`.

## Kendala Log list

Statuses: `OPEN`, `IN PROGRESS`, `RESOLVED`.

The current list view exposes only the native `Name`, `Status`, and `Assignee` columns. The scanner API also requires these hidden custom fields:

| Field | Type | ID |
| --- | --- | --- |
| Produksi Task | Task relationship | `3caa14c8-d1e1-4468-b5ec-9776792a75a7` |
| Detail Kendala | Shared custom field | `55f122d2-ebdb-4a9f-9b3a-62c0c4ab2390` |
| Tahap Saat Kendala | Dropdown | `78701661-d439-4b61-a410-2b003bb5e1ba` |
| Jenis Kendala | Dropdown | `8063622b-f743-48a7-af60-c1917dd87096` |
| PIC | People | `8c4a0d35-f288-4695-bdf3-5196f75b61ef` |

## Scanner integration

- Tasks are found by the Produksi `Barcode` field.
- Production transitions update `Tahap Produksi`, `Progress`, `Last Scan`, and `QC Result` as needed.
- A kendala creates a task in `Kendala Log`, relates it through `Produksi Task`, and marks the linked Produksi task's `Kendala` dropdown.
- Production-stage and QC option IDs are maintained in `src/lib/produksi.ts`; list field metadata is fetched by name at runtime by `src/lib/clickup.ts`.

## ClickUp API contract

All calls use `https://api.clickup.com/api/v2` with the header `Authorization: ${CLICKUP_TOKEN}`. The token stays server-side and must never be sent to the browser.

### Data received from ClickUp

| Request | What the app receives | Why it is used |
| --- | --- | --- |
| `GET /list/{listId}/field` | `{ fields: [{ id, name, type, type_config: { options: [{ id, name, orderindex }] } }] }` | Finds fields by name and resolves dropdown option UUIDs. |
| `GET /list/{produksiListId}/task?include_closed=true&custom_fields=...` | `{ tasks: [{ id, name, status, custom_fields, ... }] }` | Finds exactly one Produksi task by Barcode. |
| `GET /task/{taskId}` | `{ id, name, list, status, custom_fields, ... }` | Reads the current Tahap Produksi, scan/progress values, and validates that the task belongs to Produksi. |
| `GET /list/{kendalaListId}/task?include_closed=true` | `{ tasks: [{ id, status, custom_fields, ... }] }` | Checks whether the production task has an unresolved kendala. |

The barcode lookup is sent as a query parameter, not a JSON body:

```text
custom_fields=[{"field_id":"213fe4c2-0d5f-449f-a14b-4697d57dbfea","operator":"=","value":"DUMMY-002"}]
```

`Tahap Produksi` is a dropdown. Its current `custom_fields[].value` may be an option UUID or an option index. The app resolves that value against `type_config.options` before deciding the next stage.

### Requests sent to ClickUp

| Request | Body sent by the app | Purpose |
| --- | --- | --- |
| `POST /task/{taskId}/field/{TAHAP_PRODUKSI_FIELD_ID}` | `{ "value": "<next-option-uuid>" }` | Moves to the next production stage. The value must be the option UUID or index, never the stage label. |
| `POST /task/{taskId}/field/{LAST_SCAN_FIELD_ID}` | `{ "value": 1760000000000, "value_options": { "time": true } }` | Stores the scan timestamp in epoch milliseconds. |
| `POST /task/{taskId}/field/{PROGRESS_FIELD_ID}` | `{ "value": { "current": 50 } }` | Updates manual production progress during auto-scan. |
| `POST /task/{taskId}/field/{QC_RESULT_FIELD_ID}` | `{ "value": "<qc-option-uuid>" }` | Sets QC to pending, pass, or fail when a stage requires it. |
| `PUT /task/{taskId}` | `{ "status": "cutting" }` | Updates the ClickUp task status mapped from the next stage. |
| `POST /task/{taskId}/comment` | `{ "comment_text": "[SCAN] ...", "notify_all": false }` | Adds an audit entry for each scan/status change. |
| `POST /task/{taskId}/attachment` | Multipart form data: `attachment` image file | Optional image evidence for advance or kendala. |
| `POST /list/{kendalaListId}/task` | `{ "name": "[...]", "description": "...", "status": "open" }` | Creates a Kendala Log task. |

When creating a kendala, the app also writes its `Produksi Task` relation as `{ "value": { "add": ["<produksi-task-id>"], "rem": [] } }`, plus its Jenis, Tahap, and optional PIC fields.

### Application API used by the scanner

The browser never calls ClickUp directly. It calls these local routes, which make the ClickUp requests above:

| Local request | Browser sends | Browser receives on success |
| --- | --- | --- |
| `GET /api/produksi/{barcode}` | Barcode in URL | `{ ok: true, data: { taskId, nama, barcode, tahapSekarang, tahapBerikutnya, isQcStage, actions } }` |
| `POST /api/produksi/scan` | `{ "barcode": "DUMMY-002", "action": "advance" }` | `{ task_id, nama, barcode, from, to, progress, last_scan }` |
| `POST /api/produksi/advance` | `FormData`: `task_id`, optional `attachment`, and `qc_pass=true` for QC | `{ from, to, last_scan }` |
| `POST /api/produksi/{barcode}/kendala` | `FormData`: type, detail, optional PIC/photos | `{ ok: true, data: { kendalaId } }` |

An `advance` scan returns `409 QC_ACTION_REQUIRED` at a QC stage and `409 OPEN_KENDALA` when an unresolved kendala is linked to the task. A successful stage update writes the new dropdown UUID first; if that request fails, the API returns `CLICKUP_STAGE_UPDATE_FAILED` and logs ClickUp's response body.

Example short task IDs currently present in ClickUp: Produksi `z96buhr9e1`, `z96buhr9e2`, `z96buhr9e3`; Kendala Log `z96buhrafq`, `z96buhraft`, `z96buhrafr`.
