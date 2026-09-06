---
name: delete-duplicates
description: Alur aman hapus duplikat Immich via immich-sorter — analisa parent, buka folder, keep/trash via UI atau API, verifikasi.
---

## What I do

- Menuntun alur bersih-bersih duplikat end-to-end memakai `immich-sorter` (`Q:\immich\immich-sorter`, default `http://localhost:3000`).
- Aturan utama: hapus SELALU via API Immich (soft-trash), tidak pernah hapus file langsung di disk.
- Roll-up ke level parent (album = `/mnt/external/<bucket>/<nama>`), bukan subfolder.

## When to use me

Gunakan ketika user mau:
- Cari duplikat terbesar by size/count untuk dibersihkan.
- Memutuskan folder/parent mana yang di-keep vs di-trash.
- Trash via WebView atau `POST /api/decisions/resolve`.
- Verifikasi hasil (health, decisions, sync ulang).

## Golden rules (jangan dilanggar)

1. **Hapus via API saja** — `POST /api/decisions/resolve` (tanpa `dryRun`) → `resolveDuplicates()` → soft-trash di Immich. Jangan `Remove-Item`/hapus via explorer untuk file yang sudah terindex.
2. Kenapa: hapus langsung di disk membuat aset Immich jadi `offline/missing` sampai rescan library + bereskan offline assets manual. Sorter baru drop orphan saat `POST /api/sync`, dan tabel `folders` tidak pernah auto-delete baris basi.
3. Selalu `dryRun: true` dulu sebelum trash beneran.
4. Jangan trash parent yang grupnya **0 aman** (tidak punya copy di tempat lain) — itu konten unik, hapus = hilang permanen.

## Workflow

### 1. Analisa: parent-level, bukan subfolder

Subfolder (mis. `.../cam23101303/P`) digabung ke parent-nya (`/mnt/external/pgg/cam23101303`). Istilah:
- **aman** = grup duplikatnya punya copy di parent lain → hapus dari parent ini tidak menghilangkan konten.
- **latest** = `MAX(fileCreatedAt)` di parent — makin tua makin aman dibuang.

Query pola (sqlite3 read-only ke `sorter.db`):
```sql
-- top grup by size (target terbesar dulu)
SELECT duplicateId, COUNT(*) AS c, COALESCE(SUM(fileSize),0) AS s
FROM assets GROUP BY duplicateId ORDER BY s DESC LIMIT 5;
-- top grup by count
SELECT duplicateId, COUNT(*) AS c, COALESCE(SUM(fileSize),0) AS s
FROM assets GROUP BY duplicateId ORDER BY c DESC, s DESC LIMIT 5;
-- cek 1 parent (ganti prefix): aset, grup, size
SELECT COUNT(*), COUNT(DISTINCT duplicateId), COALESCE(SUM(fileSize),0)
FROM assets WHERE originalPath LIKE '/mnt/external/pgg/cam23101303/%';
```

### 2. Prioritas hapus

1. Grup terbesar by size (1 file ~1.4 GB × N copy = reclaim GB-an per grup).
2. Parent dengan `aman == grup` (100% ada di luar) + size besar + latest tua.
3. Contoh yang pernah dihitung: `Korean_Recruitment_Girl` + `cam23101303` + `kam21080902` = ~7.2 GB tanpa kehilangan 1 file unik.
4. Lewati parent dengan 0 aman (`안대녀`, `Really_lovely..._46`, `배우리...` sebagian besar unik).

### 3. Buka folder dari WebView

- Setiap kartu folder (cluster card + modal keep-selector) ada tombol **📂 Buka** → `POST /api/open-folder {path}`.
- Server memetakan path Immich ke Windows via env `PATH_MAP` (format `<from>=<to>;...`), default `/mnt/external/=Q:/unsorted/store/`, lalu `explorer <winPath>`.
- Menolak `..`, menolak path tanpa mapping (400), path tidak ada (404 + `winPath` untuk buka manual). Gagal → path di-copy ke clipboard + alert.
- Hanya bekerja bila browser + server di mesin Windows yang punya drive-nya.

### 4. Trash via UI (user yang klik, bukan agen)

1. WebView → atur `minShared` → Muat Cluster → Detail H2H.
2. Aktifkan filter **"Hanya tampilkan grup yang nama filenya beda"** untuk fokus ke grup yang namanya tidak identik (badge `nama beda`, nama kuning).
3. Centang folder KEEP, sisanya TRASH. Minimal keep 1.
4. Klik **Dry Run** dulu → OK → klik **Trash Pilihan**.
5. Aturan payload (dibangun `public/app.js`): hanya grup dengan `trashAssetIds.length > 0` yang dikirim; grup yang keep-nya kosong fallback keep 1 aset pertama.

### 5. Trash via API (setara tombol UI)

```bash
# dry run dulu
curl -X POST http://localhost:3000/api/decisions/resolve \
  -H "Content-Type: application/json" \
  -d '{"groups":[{"duplicateId":"dup-1","keepAssetIds":["a1"],"trashAssetIds":["b1"]}],"action":"keep:/mnt/external/pgg/cam23101303","dryRun":true}'
# kalau OK, ulangi tanpa dryRun
```

### 6. Verifikasi

```bash
curl http://localhost:3000/api/health        # dbGroups/dbAssets harus turun
curl http://localhost:3000/api/decisions     # status done, cek error
curl -X POST http://localhost:3000/api/sync  # refresh index setelah perubahan di Immich
```

## File referensi sorter

- `server.ts` — endpoint (`/api/health`, `/api/sync`, `/api/clusters`, `/api/decisions/resolve`, `/api/open-folder`, proxy thumb/video/original).
- `services/grouping.ts` — cluster = connected component pair `shared >= minShared`; grup 1-folder saja (`folders.size < 2`) tidak masuk cluster.
- `services/sync.ts` — orphan cleanup saat sync; `folders` tidak auto-delete.
- `public/app.js` — `openModal`, filter nama-beda, `doResolve`, `openFolder`.
- `.env` — `IMMICH_BASE_URL`, `IMMICH_API_KEY`, `PORT`, `DB_PATH`, `PATH_MAP`.
