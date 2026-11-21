# Stage 5: Initial Zoom Out Review

Target: `docs/migrate-db/db-schema.md`  
Reviewers: Zoom Out and Inventive Catalyst  
Scope: seluruh dokumen; tidak ada file konteks tambahan.

## Blocker

1. **Tujuan migrasi dan batas keberhasilannya belum jelas** (§1, §9). Dokumen menggabungkan perubahan nama dan struktur tabel, penggantian auth, dan penghapusan data lama tanpa menjelaskan masalah yang ingin diselesaikan atau alasan semuanya harus dilakukan bersama. Tentukan tujuan yang dapat diperiksa, batas perubahan, dan alasan tiap bagian diperlukan; pertimbangkan memisahkan perubahan yang tidak saling bergantung.

## Major

2. **Cutover dan rollback belum melindungi data baru** (§9). Urutan migrasi belum menetapkan penghentian penulisan, penyelarasan data terakhir, koordinasi deployment, atau pemulihan. Tabel `old_*` tidak otomatis menerima penulisan setelah aplikasi baru aktif, sehingga memulihkannya dapat menghilangkan data baru. Tentukan jendela cutover, backup, batas aman rollback, dan cara merekonsiliasi penulisan setelahnya.

3. **Penghapusan location belum terbukti aman untuk seluruh aplikasi** (§6). Kesamaan serial tidak membuktikan bahwa field blob lama tidak dipakai. Reviewer menemukan pembacaan data location di `src/lib/panelLocationStore.ts`; telusuri pemanggil dan tentukan pengganti atau penghentian setiap alur sebelum menyimpulkan data aman dihapus. Hasil pencarian kode ini masih perlu dikonfirmasi pada tahap berikutnya.

4. **SQL opsional tetap berjalan bila seluruh blok dijalankan** (§6.4). Perintah mengosongkan seluruh `lby_source_url` dan menghapus semua project tanpa revision diberi label opsional tetapi berada dalam transaksi yang sama. Pisahkan perintah opsional dan batasi target secara eksplisit agar menjalankan langkah utama tidak ikut menghapus data tersebut.

5. **Riwayat scan bergantung pada status komponen saat ini** (§4.4, §7). Mengambil project dari `component_status` dapat mengubah atau menghilangkan atribusi scan lama jika relasi komponen berubah atau dihapus. Simpan identitas project saat scan, atau tetapkan dan tegakkan aturan bahwa relasi dan record tersebut tidak berubah dan tidak dihapus.

6. **Cache dan lock memiliki siklus hidup berbeda** (§4.6). Menghapus lock yang masih aktif dapat mengizinkan dua proses berjalan bersamaan. Reviewer juga mencatat kemungkinan snapshot project selesai memiliki fungsi arsip, sehingga tidak semua snapshot tentu dapat dibangun ulang. Identifikasi data turunan, data arsip, dan koordinasi; jelaskan masa berlaku, kepemilikan, dan pemulihan lock serta verifikasi fungsi snapshot terhadap kode.

7. **Alur scan dan akses masih berupa dugaan** (§4.4–4.5). Dokumen belum menjelaskan urutan penulisan ke ClickUp dan database, penanganan kegagalan, serta migrasi seluruh atribut izin yang ada. Reviewer menemukan indikasi alur dan atribut tambahan di kode saat ini. Petakan perilaku aktual dan pastikan perubahan auth mempertahankan izin dan efek samping yang diperlukan.

## Batas review

Temuan ini berdasarkan pembacaan dokumen dan pemeriksaan terbatas source oleh satu reviewer. Tidak ada pengujian runtime, database, atau verifikasi data produksi. Temuan tentang perilaku aplikasi perlu ditelusuri sebelum dipakai sebagai dasar perubahan.
