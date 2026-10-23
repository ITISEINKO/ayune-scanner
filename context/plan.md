# Plan: Sync Data PPIC Panel (ClickUp App Scan)

## Tujuan

- Load list project **ongoing** & detail project (progres item per status) secara **instan**.
- Update **realtime** saat barang di-scan (counter, donut, log terbaru).
- Tidak kena rate limit ClickUp (Â±100 req/menit per token).

## Arsitektur

```
ClickUp (List TASK UTAMA)
    webhook (taskStatusUpdated, taskCreated, taskUpdated, taskDeleted)

Backend / Worker Database (source of truth)

                       Snapshot JSON per project (trimmed + agregat)

   Realtime channel (WebSocket / SSE / Supabase Realtime)


                     App Mobile
```

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
3. Susun tree di backend pakai field `parent`.
4. Simpan ke DB (lihat skema di bawah).
5. Generate snapshot JSON per project.

**Jangan:** `GET /task/{id}` satu per satu (N+1, lambat, boros rate limit).

## Fase 2: Skema Database

```sql
projects (id, code, name, status, start_date, updated_at)
groups   (id, project_id, name, total_items, updated_at)
items    (id, group_id, project_id, barcode, name, status, scanned_by, updated_at)
scan_logs(id, item_id, project_id, status, user, created_at)
```

## Fase 3: Snapshot JSON (trimmed)

Satu file per project, misal `snapshots/AY-19237.json`. Hanya field yang dibutuhkan UI + agregat yang sudah dihitung.

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
	],
	"version": 1729561234
}
```

Item detail per grup (barcode list) di-load **lazy** saat grup dibuka, bukan di snapshot utama.

Snapshot list project (`snapshots/ongoing.json`) cukup: `id, code, name`.

## Fase 4: Realtime via Webhook

1. Daftarkan webhook ClickUp: `POST /api/v2/team/{team_id}/webhook` dengan scope list TASK UTAMA.
2. Events: `taskStatusUpdated`, `taskCreated`, `taskUpdated`, `taskDeleted`.
3. Verifikasi signature (`X-Signature`, HMAC-SHA256 dengan webhook secret).
4. Handler:
   - Fetch task yang berubah (1 request), atau pakai data `history_items` dari payload.
   - Update DB (item + insert scan_log).
   - Recompute agregat project terkait, regenerate snapshot.
   - Broadcast delta ke channel `project:{code}`.
5. Idempotensi: simpan `history_item.id` supaya event duplikat tidak dihitung dua kali.

## Fase 5: Flow Scan dari App

1. User scan barcode app kirim ke backend.
2. Backend update DB **dulu** (optimistic) broadcast UI semua device langsung update.
3. Queue job tulis ke ClickUp (update status) di background, dengan retry + backoff kalau kena 429.
4. Webhook balik dari ClickUp di-dedupe (sudah ada di DB, skip).

## Fase 6: App Client

1. Buka halaman fetch snapshot (cache lokal, tampil instan).
2. Subscribe ke channel `project:{code}`.
3. Terima delta patch state lokal (counter, donut, log).
4. Kalau `version` snapshot lebih baru dari state lokal refetch.
5. Tombol **Sync** = trigger re-sync satu project (`GET /team/{team_id}/task?parent={task_id}&subtasks=true`).

## Fallback & Safety

- Cron re-sync ringan tiap 1530 menit untuk project ongoing (nangkep webhook yang miss).
- Kalau realtime putus polling snapshot tiap 510 detik.
- Rate limit: semua call ClickUp lewat 1 queue dengan throttle.
- Token ClickUp **hanya di backend**, jangan di app.

## Checklist

- [ ] Konfirmasi lokasi status scan (status vs custom field)
- [ ] Mapping status ClickUp 6 kategori UI
- [ ] Setup DB + skema
- [ ] Script initial sync
- [ ] Generator snapshot per project
- [ ] Endpoint webhook + verifikasi signature
- [ ] Realtime channel
- [ ] Endpoint scan + queue tulis ke ClickUp
- [ ] Client: snapshot + subscribe + patch delta
- [ ] Cron re-sync + fallback polling
