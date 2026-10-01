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

Example short task IDs currently present in ClickUp: Produksi `z96buhr9e1`, `z96buhr9e2`, `z96buhr9e3`; Kendala Log `z96buhrafq`, `z96buhraft`, `z96buhrafr`.
