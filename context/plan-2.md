# Plan: Sync Data PPIC Panel (ClickUp App Scan)

**Versi: DB + Webhook (tanpa snapshot JSON)**

## Tujuan

- Load list project **ongoing** & detail project (progres item per status) secara **instan**.
- Update **realtime** saat barang di-scan (counter, donut, log terbaru).
- Tidak kena rate limit ClickUp (Â±100 req/menit per token).

## Arsitektur

```
ClickUp (List TASK UTAMA)
     webhook (taskStatusUpdated, taskCreated, taskUpdated, taskDeleted)

Backend  Database (source of truth)

                query (trimmed + agregat)
           REST API  App Mobile (initial load)

Realtime channel (WebSocket / SSE / Supabase Realtime)  App Mobile (delta)
```

App **tidak pernah** call ClickUp langsung. Semua baca dari API backend DB.

## Struktur Data ClickUp

| Level       | Isi                       | Contoh                                     |
| ----------- | ------------------------- | ------------------------------------------ |
| Parent task | Project (status: ongoing) | AY-19237 RUKO JAKARTA PASAR MINGGU         |
| Subtask     | Grup material             | HPL-SOLID-DOUBLE+Plywood+19, HARDWARE LIST |
| Sub-subtask | Item / barcode            | 15370046509 - Right Side Panel             |

> Cek dulu: status scan disimpan di **status task** atau **custom field**? Ini menentukan event webhook yang didengar.

## Fase 1: Initial Sync (sekali / manual re-sync)

1. Panggil:
   ```
   GET /api/v2/team/{team_id}/task
     ?list_ids[]={LIST_TASK_UTAMA_ID}
     &subtasks=true
     &include_closed=true
     &page={N}
   ```
2. Loop `page` sampai `last_page = true` (100 task/page).
3. Susun tree pakai field `parent`.
4. **Trim** ke field yang dibutuhkan saja, lalu upsert ke DB.

**Jangan:** `GET /task/{id}` satu per satu (N+1, lambat, boros rate limit).

## Fase 2: Skema Database

```sql
projects  (id PK, code, name, status, start_date, updated_at)
groups    (id PK, project_id FK, name, updated_at)
items     (id PK, group_id FK, project_id FK, barcode, name, status, scanned_by, updated_at)
scan_logs (id PK, item_id FK, project_id FK, status, user_name, created_at)
webhook_events (history_item_id PK, received_at)   -- dedupe

-- index
CREATE INDEX ON items (project_id, status);
CREATE INDEX ON items (group_id, status);
CREATE INDEX ON scan_logs (project_id, created_at DESC);
CREATE INDEX ON projects (status);
```

Field yang disimpan per item cukup: `id, parent (group_id), barcode, name, status, scanned_by, updated_at`.

## Fase 3: REST API (trimmed + agregat dari DB)

### `GET /projects?status=ongoing`

```json
[{ "id": "abc123", "code": "AY-19237", "name": "RUKO JAKARTA PASAR MINGGU" }]
```

### `GET /projects/{code}`

Agregat dihitung via SQL (`COUNT ... GROUP BY status`), bukan di app.

```json
{
	"id": "abc123",
	"code": "AY-19237",
	"name": "RUKO JAKARTA PASAR MINGGU",
	"start": "2026-10-13T15:50:00+07:00",
	"total": 258,
	"done": 0,
	"summary": {
		"unscanned": 39,
		"diterima": 206,
		"dipacking": 6,
		"terpasang": 0,
		"retur": 7,
		"lainnya": 0
	},
	"groups": [
		{
			"id": "g1",
			"name": "HPL-SOLID-DOUBLE+Plywood+19",
			"total": 34,
			"summary": {
				"unscanned": 2,
				"diterima": 25,
				"dipacking": 0,
				"terpasang": 0,
				"retur": 7,
				"lainnya": 0
			}
		}
	],
	"members": [
		{ "name": "Krisdianto", "scan": 208 },
		{ "name": "Edianto", "scan": 6 }
	],
	"recent_logs": [
		{
			"barcode": "15370046509",
			"name": "Right Side Panel",
			"status": "retur",
			"by": "Krisdianto",
			"at": "2026-10-19T11:58:00+07:00"
		}
	]
}
```

Contoh query summary:

```sql
SELECT status, COUNT(*) FROM items WHERE project_id = $1 GROUP BY status;
SELECT group_id, status, COUNT(*) FROM items WHERE project_id = $1 GROUP BY group_id, status;
SELECT scanned_by, COUNT(*) FROM scan_logs WHERE project_id = $1 GROUP BY scanned_by;
SELECT * FROM scan_logs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 5;
```

### `GET /groups/{id}/items`

List barcode per grup, **lazy load** saat grup dibuka.

> Opsional kalau nanti terasa berat: cache response `GET /projects/{code}` di memory/Redis beberapa detik, invalidate saat ada update. Bukan file JSON.

## Fase 4: Realtime via Webhook

1. Daftarkan webhook: `POST /api/v2/team/{team_id}/webhook` scope list TASK UTAMA.
2. Events: `taskStatusUpdated`, `taskCreated`, `taskUpdated`, `taskDeleted`.
3. Verifikasi `X-Signature` (HMAC-SHA256 dengan webhook secret).
4. Handler:
   - Cek `history_item.id` di `webhook_events` kalau sudah ada, skip.
   - Update `items`, insert `scan_logs`.
   - Broadcast delta ke channel `project:{code}`:
     `json
     {
     	"item_id": "x1",
     	"group_id": "g1",
     	"from": "unscanned",
     	"to": "diterima",
     	"by": "Krisdianto",
     	"at": "..."
     }
     `
     .

## Fase 6: App Client

1. Buka halaman `GET /projects/{code}` render.
2. Subscribe channel `project:{code}`.
3. Terima delta patch state lokal (kurangi counter `from`, tambah `to`, prepend log).
4. Reconnect refetch `GET /projects/{code}` biar state sinkron lagi.
5. Tombol **Sync** `POST /projects/{code}/resync` (backend fetch ulang `GET /team/{team_id}/task?parent={task_id}&subtasks=true`).

## Fallback & Safety

- Cron re-sync tiap 15â€“30 menit untuk project ongoing (nangkep webhook yang miss).
- Realtime putus polling `GET /projects/{code}` tiap 5â€“10 detik.
- Semua call ClickUp lewat 1 queue dengan throttle.
- Token ClickUp **hanya di backend**.

## Checklist

- [ ] Konfirmasi lokasi status scan (status vs custom field)
- [ ] Mapping status ClickUp 6 kategori UI
- [ ] Setup DB + skema + index
- [ ] Script initial sync
- [ ] REST API: `/projects`, `/projects/{code}`, `/groups/{id}/items`
- [ ] Endpoint webhook + verifikasi signature + dedupe
- [ ] Realtime channel
- [ ] Endpoint `/scan` + queue tulis ke ClickUp
- [ ] Client: fetch + subscribe + patch delta
- [ ] Cron re-sync + fallback polling
