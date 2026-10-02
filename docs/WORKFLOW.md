# Production Scanner Workflow and Routing

This document describes the routes and behavior currently implemented in the application.

## User routes

| Route | Screen | Purpose | API used |
| --- | --- | --- | --- |
| `/` | Production Scanner | Look up a product, show its current production stage, and manually advance it. | `GET /api/produksi/:barcode`, `POST /api/produksi/advance` |
| `/scan` | Buka task ClickUp | Open the ClickUp Produksi task that matches a barcode. | `GET /api/find-task` |
| `/autoscan` | Scan untuk update status | Immediately advance the production stage after a scan. | `POST /api/produksi/scan` |

All scanner screens accept either camera input or manual barcode input. The camera scanner stops after it detects a barcode; `/autoscan` starts the camera automatically.

```mermaid
flowchart TD
  Home[/`] --> Lookup[Scan or enter barcode]
  Lookup --> Detail[GET /api/produksi/:barcode]
  Detail --> Drawer[Show current and next Tahap Produksi]
  Drawer -->|LANJUT| Advance[POST /api/produksi/advance]
  Advance --> ClickUp[(ClickUp Produksi task)]

  Direct[/scan] --> Find[Scan or enter barcode]
  Find --> FindTask[GET /api/find-task]
  FindTask --> ClickUpTab[Open task URL in a new tab]

  Auto[/autoscan] --> AutoScan[Scan or enter barcode]
  AutoScan --> Scan[POST /api/produksi/scan]
  Scan --> ClickUp
```

## Active workflows

### `/` - look up, confirm, then advance

1. The operator scans or types a barcode.
2. The browser requests `GET /api/produksi/:barcode`.
3. The server finds the task by its `Barcode` custom field, reads the task's `Tahap Produksi`, and returns the current and next stage.
4. The page shows a bottom drawer with the product name and current stage.
5. The operator confirms **LANJUT KE &lt;next stage&gt;**.
6. The browser posts the ClickUp task ID to `POST /api/produksi/advance`.
7. The server optionally uploads one image attachment, advances `Tahap Produksi`, updates `Last Scan`, synchronizes the ClickUp task status, and adds a `[STATUS]` comment.
8. The page re-reads the task so the drawer shows the current state.

The advance button is hidden when the current stage is `Pengiriman`.

### `/scan` - open the ClickUp task

1. The operator scans or types a barcode.
2. The page opens a blank tab immediately, so browsers treat it as a user-initiated popup.
3. It requests `GET /api/find-task?code=:barcode`.
4. The server returns the first matching ClickUp task URL.
5. The blank tab navigates to that URL. If more than one task matches, the first task opens and the page reports the duplicate.

### `/autoscan` - advance immediately

1. The operator scans or types a barcode.
2. The browser posts `{ "barcode", "action": "advance" }` to `POST /api/produksi/scan`.
3. The server finds the unique task and calculates the next production stage.
4. It updates ClickUp: `Tahap Produksi`, `Last Scan`, `Progress`, task status, `Start Production` on the first handover scan, then a `[SCAN]` audit comment.
5. The page shows a success dialog with the previous and new stages.

## API routing

| Method | Route | Called by | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/find-task?code=:barcode` | `/scan` | Returns `{ url, count }` for the first matching ClickUp task. |
| `GET` | `/api/produksi/:barcode` | `/` | Returns the production task and its current/next stage. |
| `POST` | `/api/produksi/advance` | `/` | Expects `FormData` with `task_id`; accepts optional image `attachment`. |
| `POST` | `/api/produksi/scan` | `/autoscan` | Expects JSON with `barcode` and `action`. The UI currently sends `advance`. |
| `GET` | `/api/produksi/kendala-options` | No current UI caller | Returns ClickUp `Jenis Kendala` dropdown options. |
| `POST` | `/api/produksi/:barcode/kendala` | No current UI caller | Creates a Kendala task, links it to production, and uploads 1-3 photos. |

`POST /api/produksi/scan` also supports the server-only `release_komplain` action. It requires an approved `operator_id` from `CLICKUP_SPV_OPERATOR_IDS` and a valid `rework_to` stage; no current screen sends this action.

## Production-stage routing

Normal `advance` requests use the ordered `Tahap Produksi` flow below. `Komplain` is outside this linear flow and can only move to a rework stage through `release_komplain`.

```text
Handover Produksi
  -> Persiapan Material
  -> QC Material
  -> Pelapisan Bahan
  -> Marking & Cutting
  -> QC Hasil Potong
  -> Edging
  -> Drilling
  -> Finishing Pelapisan
  -> QC3 - QC WS
  -> QC4 - QC Assembly
  -> Dis-assembling
  -> Packing
  -> Pengiriman
```

The scan endpoint also sets progress by stage: `5, 10, 15, 25, 35, 45, 55, 62, 70, 78, 85, 90, 95, 100` respectively. ClickUp task status is mapped from the destination stage (for example, `Marking & Cutting` -> `cutting`, `Packing` -> `packing`, and `Pengiriman` -> `done`).

## ClickUp boundary

The browser never receives `CLICKUP_TOKEN` and never calls ClickUp directly. Every API route uses the server-side token and `CLICKUP_PRODUKSI_LIST_ID` (or the production-list fallback) to query or update ClickUp.

Common failures returned by the API are missing configuration, missing/duplicate barcode, rate limiting, an unset or invalid production stage, and an invalid final-stage transition.
