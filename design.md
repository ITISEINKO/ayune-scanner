# Design.md — Layout, Spacing & Shape

Panduan ukuran untuk UI mobile (lebar ≈ 360–480px). **Tidak ada warna di sini.** Warna dipetakan dari token milik kamu lewat nama peran di bagian paling bawah.

Semua angka dalam `px`. Kolom "Tailwind" memakai skala default (1 unit = 4px).

---

## 1. Prinsip

1. **Skala 4px.** Semua jarak kelipatan 4 (boleh 6 dan 10 untuk jarak rapat di dalam komponen).
2. **Satu margin halaman: 16.** Semua konten sejajar di kiri-kanan 16.
3. **Radius makin besar untuk elemen makin besar.** Kartu 20, kontrol 14, pil penuh.
4. **Satu pola halaman:** header sticky → konten berseksi → bottom nav mengambang.
5. **Target sentuh minimal 40×40.**

---

## 2. Spacing scale

| Token       | px  | Tailwind | Dipakai untuk                                                                  |
| ----------- | --- | -------- | ------------------------------------------------------------------------------ |
| `space-1`   | 4   | `1`      | Gap dot status, margin label ke angka                                          |
| `space-1.5` | 6   | `1.5`    | Gap ikon kecil ke teks, jarak chip dalam                                       |
| `space-2`   | 8   | `2`      | Gap antar chip, gap antar bar chart, gap grid mini                             |
| `space-2.5` | 10  | `2.5`    | Gap grid 2 kolom, jarak antar kartu dalam list, jarak tombol berdampingan      |
| `space-3`   | 12  | `3`      | Gap ikon ke teks di baris, jarak antar kartu bertumpuk, jarak elemen di header |
| `space-3.5` | 14  | `3.5`    | Padding baris list, padding kartu kecil                                        |
| `space-4`   | 16  | `4`      | **Margin halaman**, padding kartu                                              |
| `space-4.5` | 18  | `[18px]` | Jarak antar seksi (atas seksi)                                                 |
| `space-5`   | 20  | `5`      | Padding teks lead / paragraf pengantar                                         |

---

## 3. Layout halaman

```
┌──────────────────────────────┐
│ safe-area-top                │ ← bagian dari header (warna sama)
│ HEADER (sticky)              │
├──────────────────────────────┤
│  content  (px 16)            │
│  ┌────────────────────────┐  │
│  │ section                │  │
│  └────────────────────────┘  │
│                              │
│ (ruang kosong 100 di bawah)  │
└─ ┌──────────────────────┐ ───┘
   │ BOTTOM NAV (floating)│
   └──────────────────────┘
```

| Aturan                               | Nilai                           |
| ------------------------------------ | ------------------------------- |
| Lebar maksimum konten                | `480` (di tengah)               |
| Margin kiri-kanan halaman            | `16`                            |
| Padding bawah area scroll            | `100` (agar tidak tertutup nav) |
| Jarak atas seksi                     | `18`                            |
| Judul seksi (label kecil) ke konten  | `8` (`mb-2`), indent kiri `4`   |
| Jarak antar kartu bertumpuk          | `12` (`space-y-3`)              |
| Jarak antar kartu dalam list panjang | `10` (`space-y-2.5`)            |

**Safe area:** `padding-top` safe-area dipindah ke **header**, bukan ke body. Dengan begitu warna header menutupi area status bar dan menyatu. Bottom nav memakai `bottom: 8 + safe-area-bottom`.

---

## 4. Radius scale

| Token        | px  | Tailwind           | Dipakai untuk                                     |
| ------------ | --- | ------------------ | ------------------------------------------------- |
| `r-pill`     | 99  | `rounded-full`     | Chip, badge, toggle, progress bar, status         |
| `r-sheet`    | 28  | `rounded-[28px]`   | Bottom sheet (sudut atas)                         |
| `r-header`   | 26  | `rounded-b-[26px]` | Header (sudut bawah saja)                         |
| `r-nav`      | 24  | `rounded-3xl`      | Bottom nav                                        |
| `r-lg`       | 20  | `rounded-[20px]`   | **Kartu, list group**, kartu project              |
| `r-nav-item` | 18  | `rounded-[18px]`   | Item aktif di bottom nav, avatar besar (56)       |
| `r-md`       | 16  | `rounded-2xl`      | Kartu stat, box dalam kartu, avatar 48            |
| `r-sm`       | 14  | `rounded-[14px]`   | **Input, tombol**, tombol back, segmented control |
| `r-xs`       | 12  | `rounded-xl`       | Kotak ikon (36), avatar 40 (13)                   |
| `r-xxs`      | 11  | `rounded-[11px]`   | Tombol di dalam segmented control                 |

Aturan nested: radius elemen di dalam = radius induk − padding (kira-kira). Contoh: kartu 20 berisi box 16, berisi pil 99.

---

## 5. Header (shared, sticky)

| Properti                           | Nilai                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Posisi                             | `sticky; top: 0; z-index: 6`                                               |
| Padding                            | `top: safe-area + 12`, `x: 16`, `bottom: 14`                               |
| Radius                             | `0 0 26 26`                                                                |
| Baris utama                        | `flex`, `items-center`, `gap 12`                                           |
| Tombol back                        | `40×40`, radius `14`, hanya ikon (stroke 2, ikon 20)                       |
| Eyebrow (teks kecil di atas judul) | 13 / regular                                                               |
| Judul                              | 21 / 700, `tracking -0.3`, satu baris + ellipsis                           |
| Tombol aksi kanan                  | padding `9 × 13`, radius `14`, teks 13 / 600, ikon 16                      |
| Search di dalam header             | `mt 12`, input tinggi ≈ 44, padding kiri `40` (ruang ikon)                 |
| Tab (segmented) di dalam header    | `mt 12`                                                                    |
| Judul panjang                      | Ada chevron 18; ketuk = buka nama penuh (wrap), **auto-tutup saat scroll** |

Urutan isi header: `[back] [eyebrow + judul] [aksi]` → opsional `search` / `tab` di baris bawah.

---

## 6. Komponen

### 6.1 Card

|                    |                                      |
| ------------------ | ------------------------------------ |
| Padding            | `16` (kartu stat: `12`)              |
| Radius             | `20` (stat: `16`)                    |
| Border             | `1`                                  |
| Shadow             | Tidak dipakai. Pembeda lewat border. |
| Margin antar kartu | `12`                                 |
| Judul kartu        | 14–15 / 600                          |
| Deskripsi kartu    | 12.5 / regular, `mt 6`, `mb 10`      |

### 6.2 List group & row

Satu container `rounded 20 + border 1`, isinya baris dipisah garis `1`. Tidak ada gap antar baris.

|                           |                                               |
| ------------------------- | --------------------------------------------- |
| Padding baris             | `12 × 14` (baris user/aktivitas: `11 × 14`)   |
| Gap ikon → teks → chevron | `12`                                          |
| Kotak ikon                | `36×36`, radius `12`, ikon `18`, stroke `1.8` |
| Judul baris               | 14 / 600                                      |
| Sub-teks baris            | 12 / regular, satu baris + ellipsis           |
| Chevron                   | `16`, stroke `2`                              |
| Baris terakhir            | tanpa garis bawah                             |

### 6.3 Avatar

| Ukuran | Radius | Font     |
| ------ | ------ | -------- |
| 40     | 13     | 13 / 700 |
| 48     | 16     | 13 / 700 |
| 56     | 18     | 18 / 700 |

Bentuk rounded-square (bukan lingkaran). Isi inisial 2 huruf.

### 6.4 Button

| Varian                       | Padding                | Radius | Teks     |
| ---------------------------- | ---------------------- | ------ | -------- |
| Primary / Ghost (full width) | `11 × 14`              | `14`   | 14 / 600 |
| Kecil (inline)               | `8 × 14`               | `14`   | 14 / 600 |
| Aksi header                  | `9 × 13`               | `14`   | 13 / 600 |
| Tombol berdampingan          | grid 2 kolom, gap `10` |        |          |

Jarak tombol ke elemen di atasnya: `10`.

### 6.5 Input

Padding `12 × 14`, radius `14`, border `1`, font 14. Dengan ikon kiri: padding kiri `40`, ikon `18` di posisi `left 13`.

### 6.6 Chip (filter)

Padding `6 × 13`, radius pill, border `1`, teks 13 / 600. Gap antar chip `8`. Container scroll horizontal tanpa scrollbar, padding `12 16 4`. Chip aktif = terisi penuh.

### 6.7 Segmented control / tab

Container padding `4`, radius `14`. Tombol `flex-1`, padding `8`, radius `11`, teks 14 / 600. Tombol aktif terisi.

### 6.8 Toggle

`46 × 27`, radius pill, knob `21` dengan inset `2`, transisi `0.2s`. Baris toggle: padding `11–12` vertikal, garis `1` di antaranya.

### 6.9 Badge / status pill

Padding `2–3 × 9`, radius pill, teks 11 / 700. Dot status: `8–10` bulat.

### 6.10 Progress & chart

| Elemen                        | Ukuran                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| Stacked bar status (detail)   | tinggi `12`, radius pill                                               |
| Stacked bar mini (kartu list) | tinggi `8`                                                             |
| Progress track                | tinggi `6`                                                             |
| Bar chart harian              | tinggi area `120`, gap `8`, bar radius atas `7`, bawah `3`, label `11` |
| Angka besar (stat)            | 26 / 700, `tracking -0.5`, line-height 1.2                             |

### 6.11 Stat grid

- 2 kolom, gap `10`, `mb 12`
- 3 kolom mini (di dalam kartu): gap `8`, tiap sel padding `10`, radius `14`, label 11, angka 18 / 700

### 6.12 Timeline

Dot `10` bulat, garis penghubung `2`, indent konten kiri `22`, jarak antar entri `14`.

### 6.13 Catatan lipat (explain text)

Pakai `<details>`: ikon info `15` + judul 12.5 / 600, `mt 10`. Isi 12.5, line-height 1.5, `mt 6`. Cocok untuk penjelasan panjang agar kartu tetap ringkas.

### 6.14 Empty state

Center, padding `12 × 6`, judul 600 + satu kalimat alasan 13. Selalu jelaskan kenapa kosong.

### 6.15 Bottom nav

|                   |                                                            |
| ----------------- | ---------------------------------------------------------- |
| Posisi            | `absolute; left 8; right 8; bottom 8 + safe-area`          |
| Padding container | `6`                                                        |
| Radius            | `24`                                                       |
| Item              | `flex-1`, padding `8 × 0`, radius `18`, gap ikon-label `3` |
| Ikon              | `20`, stroke `1.8`                                         |
| Label             | 11 / 600                                                   |
| Jumlah item       | 5                                                          |

### 6.16 Toast

Padding `9 × 16`, radius pill, teks 13, muncul `bottom: 100`, tampil ±1.6 detik.

### 6.17 Bottom sheet (jika dipakai)

Radius atas `28`, maks tinggi `90%`, grabber `44×5` dengan `mt 10`, padding isi `18`.

---

## 7. Typography

Font: **Plus Jakarta Sans** (fallback `system-ui`). Isi 14 / line-height 1.4 / weight 500.

| Peran                | Ukuran  | Weight | Catatan                   |
| -------------------- | ------- | ------ | ------------------------- |
| Judul halaman        | 21      | 700    | tracking -0.3             |
| Heading seksi (`h2`) | 17      | 700    |                           |
| Angka besar          | 26      | 700    | tracking -0.5             |
| Judul kartu / baris  | 14–15   | 600    |                           |
| Body                 | 14      | 500    |                           |
| Label seksi (`h3`)   | 12      | 600    | muted, `mb 8`, indent `4` |
| Caption / sub-teks   | 12–12.5 | 500    | muted                     |
| Eyebrow header       | 13      | 500    | muted                     |
| Badge / micro        | 11      | 700    |                           |

Hanya 3 weight: **500, 600, 700**. Hindari ALL CAPS.

---

## 8. Ikon

Gaya stroke (outline), `stroke-width 1.8` (aksi/header: `2`), `linecap round`, `linejoin round`. Ukuran: 15 (inline teks), 16 (chevron/tombol kecil), 18 (kotak ikon), 20 (nav & back).

---

## 9. Motion

| Interaksi                          | Durasi                                    |
| ---------------------------------- | ----------------------------------------- |
| Toggle, chevron putar, hover/press | `0.2s`                                    |
| Sheet naik                         | `0.25s ease`                              |
| Toast                              | `0.25s`                                   |
| Press state                        | ganti latar ke warna "chip" (tanpa scale) |

Hormati `prefers-reduced-motion` (matikan semua transisi).

---

## 10. Pola halaman (template)

**List page** → `Header (judul + aksi + search)` → `Chip filter` → `Daftar kartu (space-y 10)`.

**Settings / menu** → `Header` → `Lead paragraf` → per seksi: `Label seksi` + `List group`.

**Detail page** → `Header (back + judul + aksi + tab)` → `Kartu-kartu (space-y 12)` → catatan kaki 12 muted.

**Panjang konten:** kalau satu halaman lebih dari ±4 kartu atau terasa padat, pecah jadi tab di header, jangan memanjangkan scroll.

---

Hanya nama peran, tanpa nilai:

`background`, `surface (card)`, `text`, `text-muted`, `border`, `surface-subtle (chip/press)`, `accent (tombol aksi header, tab aktif)`, `primary (tombol utama, chip aktif, nav)`, `header-surface`, `success`, `danger`, dan satu warna per status item (belum scan, diterima, dipacking, terpasang, retur).

Dukung mode gelap lewat token yang sama, jangan hardcode warna di komponen.
