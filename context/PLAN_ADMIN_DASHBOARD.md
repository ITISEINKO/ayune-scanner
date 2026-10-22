# Plan: Admin Project Dashboard (Cepat + Realtime)
**Scope: hanya sisi admin. Scan flow member (`/api/panel/scan`, serial cache, project selection) TIDAK diubah.**
Stack tetap: Next.js di Vercel + Turso + Ably (sudah ada di codebase).

## Masalah sekarang (dari audit)
| # | Masalah | Sumber |
|---|---|---|
| 1 | Cold load lambat: tiap cache miss traverse semua descendant di ClickUp (`/team/{id}/task?parent=` paginated) + `time_in_status` | `buildProjectDashboard` |
| 2 | Cache descendant di process `Map` 60s, di Vercel tiap instance punya Map sendiri, jadi sering miss | `getProjectDashboard` |
| 3 | `cachedProjectDashboard` `revalidate: false`: perubahan struktur (task baru/hapus/pindah) stale sampai Sync manual | `unstable_cache` |
| 4 | Update status cuma lewat polling 30 detik, bukan realtime | `GET /api/project/changes` |
| 5 | Webhook `scan-hook` cuma update row yang sudah ada & tidak broadcast; edit langsung di ClickUp gak kelihatan realtime | `clickup/scan-hook` |
| 6 | Gak ada timing log, jadi gak tahu bottleneck sebenarnya | semua `fetch()` |

## Prinsip
- **Status** = dari Turso (`ppic_component_status`), sudah di-maintain oleh scan flow + webhook.
- **Struktur** (project → grup → item) = dari ClickUp, tapi di-cache di **Turso**, bukan process Map.
- **Realtime** = Ably subscribe di admin page, polling jadi fallback.
- ClickUp hanya dipanggil saat struktur berubah / Sync manual, bukan tiap buka dashboard.

## Langkah (urut dari paling murah & berdampak)

### Step 0: Ukur dulu (1 jam)
- Bungkus fetch ClickUp & query Turso di `buildProjectDashboard` dengan timer:
  `console.log(JSON.stringify({ route, op, ms, status, cacheHit }))`
- Lihat di Vercel logs: yang lama itu descendants, `time_in_status`, atau Turso.

### Step 1: Realtime admin via Ably (tanpa ubah scan route)
- Cek dulu: `/api/panel/scan` **sudah publish ke Ably** atau belum (audit menyebut ada logging Ably publish).
  - **Sudah** → admin page tinggal subscribe channel yang sama.
  - **Belum** → jangan ubah scan route. Pakai Step 1b.
- Admin page:
  1. Render awal dari server (dashboard).
  2. Subscribe `project:{mainTaskId}` → patch counter/donut/log di state client.
  3. Polling `/api/project/changes` diturunkan jadi **fallback**: jalan hanya saat Ably disconnected, atau tiap 60 detik buat jaga-jaga.
- Token Ably untuk admin: endpoint `GET /api/ably/token` (capability **subscribe-only** ke channel project).

**Step 1b (kalau scan route belum publish):** percepat polling admin ke 5 detik, tapi bikin murah:
- `changes?since=` balikin `204` kalau gak ada perubahan.
- Pastikan index `ppic_scan_history(project_id, created_at)` / `ppic_component_status(project_id, updated_at)`.

### Step 2: Webhook ikut broadcast + cover edit dari ClickUp
Di `/api/clickup/scan-hook` (bukan scan route):
- Setelah update `ppic_component_status`, **publish ke Ably** channel project terkait.
- Kalau row belum ada → **upsert** (bukan ignore), supaya edit langsung di ClickUp tetap masuk.
- Dedupe pakai `history_item.id` (tabel kecil `webhook_events`) biar gak dobel saat scan dari app memicu webhook balik.
- Tambah validasi `list_id`/`team_id` dari payload.

### Step 3: Struktur project di-cache di Turso (ganti process Map)
- Tabel baru, terpisah dari serial cache member:
  ```sql
  CREATE TABLE admin_project_structure (
    project_id TEXT PRIMARY KEY,
    structure  TEXT,      -- tree trimmed: grup + item (id, name, serial, group_id)
    built_at   TEXT,
    version    INTEGER
  );
  ```
- `buildProjectDashboard`: baca struktur dari tabel ini dulu. Miss / expired (mis. > 30 menit) → fetch ClickUp → simpan.
- Status tetap di-overlay dari `ppic_component_status` (sudah ada via `applyProjectStatusChanges`).
- Hasilnya: buka dashboard = 2–3 query Turso, **0 call ClickUp** di jalur normal.

### Step 4: Invalidasi struktur otomatis (fix stale)
- Tambah event di webhook registration: `taskCreated`, `taskDeleted`, `taskMoved` (selain `taskUpdated`).
- Handler event itu: tandai `admin_project_structure` project terkait expired + `revalidateTag('clickup-project-data')` + publish `{ type: "structure_changed" }` ke Ably → admin page refetch.
- Ganti `revalidate: false` jadi TTL (mis. 300 detik) sebagai jaring pengaman.

### Step 5: `time_in_status` lazy
- Pisahkan dari render utama: load setelah halaman tampil (`GET /api/project/time-in-status`), cache 5–10 menit.
- Dashboard gak nunggu data durasi.

### Step 6: Agregat dihitung di Turso
- Hitung summary per status / per grup / per member pakai `GROUP BY` di Turso (`ppic_component_status` + `ppic_scan_history`), bukan loop descendants ClickUp.
- Skala ratusan item per project → `GROUP BY` masih murah. Tabel counter baru perlu kalau nanti row reads Turso mulai mepet.

## Yang sengaja TIDAK disentuh
- `/api/panel/scan`, `findSerial`, `updateStatus`
- `projectSerialCache` + preload saat project selection
- `MemberScannerPage`, `MemberProjects`
- Urutan tulis ClickUp → Turso di scan

## Catatan (di luar scope, buat nanti)
- Scan flow: ClickUp sukses tapi Turso gagal = data beda. Webhook upsert di Step 2 bantu menambal ini secara otomatis.
- Gak ada refresh token OAuth; token admin expired = harus login ulang.
- 0 timeout/retry di semua fetch: minimal tambahkan `AbortSignal.timeout(10000)` di read path admin.

## Checklist
- [ ] Step 0: timing log di `buildProjectDashboard`
- [ ] Cek apakah scan route sudah publish Ably
- [ ] Step 1: admin subscribe Ably + token subscribe-only + polling jadi fallback
- [ ] Step 2: scan-hook upsert + dedupe + publish Ably
- [ ] Step 3: tabel `admin_project_structure` + baca dari Turso
- [ ] Step 4: webhook `taskCreated/Deleted/Moved` + invalidasi + TTL
- [ ] Step 5: `time_in_status` lazy load
- [ ] Step 6: agregat via SQL di Turso
