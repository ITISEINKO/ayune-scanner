<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Type rules

- `src/types/` is the canonical location and blueprint for shared TypeScript types.
- Before defining a type or interface, search `src/types/` and the rest of the codebase for an existing compatible type and reuse it.
- Do not create duplicate or new types by default. If no suitable type exists, ask for confirmation before creating one.
- Move reusable types found in feature or library files into `src/types/` instead of keeping parallel definitions. Keep a type local only when it is truly private to that module.

# Engineering KB (wajib)

Vault pengetahuan: `C:\Users\User\Documents\CODE\kb-obsidian-vault`
Aturan lengkap: `C:\Users\User\Documents\CODE\kb-obsidian-vault\00-Home\AGENT-RULES.md` (baca hanya kalau perlu detail, mis. saat membuat note baru)

**Bahasa output:** Hanya proses penjelasan atau deskripsi yang ditulis dalam Bahasa Indonesia agar mudah dipahami. Heading, label, dan istilah teknis yang umum boleh tetap dalam English; pertahankan kode, command, path, dan pesan error dalam bentuk aslinya. Hanya Saat write di note obsidian, bukan di repo ini

## Aturan singkat

1. Sebelum debugging error, integrasi, atau memilih library: cari di `C:\Users\User\Documents\CODE\kb-obsidian-vault\03-Error-Solutions` pakai `rg` (pesan error + nama teknologi). Buka maksimal 1-3 note paling cocok. Jangan baca seluruh folder.
2. Tugas kecil (edit teks, perubahan sepele) tidak perlu cari di KB.
3. Note lama = referensi. Cocokkan versi dan kondisi project sekarang sebelum dipakai.
4. Setelah selesai: catat log di `06-Project-Logs/<project>/`. Error baru yang reusable jadi note di `03-Error-Solutions/` dengan `status: unverified`.
5. Jangan menebak root cause. Tidak ada note yang cocok? Bilang terang-terangan.
6. Jangan simpan secret (API key, token, password, cookie) di vault.
7. Sebutkan note (ID/judul) yang dipakai saat membuat keputusan teknis.
8. Hubungkan note baru dengan wikilink dua arah (log <-> error). Cek file tujuan ada sebelum menulis link. Placeholder ditulis di dalam backtick.
9. Project lama tanpa catatan di vault: pakai prompt `07-Templates/Prompts/Backfill-Lite-Project-Knowledge.md`. Hanya dari bukti nyata, semua note `unverified` + `backfill: true`.
10. Nama folder project = nama project/pekerjaan (mis. `ginee-clickup-sync`), bukan nama teknologi. Log: `06-Project-Logs/<project>/YYYY-MM-DD-judul.md` (flat).
