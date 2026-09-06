---
name: immich-sorter-api
description: Panduan memakai API immich-sorter (Bun H2H folder deduplicator untuk Immich) dari project ini — sync, clusters, resolve, dan proxy thumb/video.
---

## What I do

- Menjelaskan API `immich-sorter` di `Q:\immich\immich-sorter` (`Bun.serve` + `bun:sqlite` + `@immich/sdk@3.1.0`).
- Memberi contoh request/response untuk integrasi dari Elysia/Bun di repo ini.
- Menjaga invariant: `folder = posix.dirname(originalPath)`, pair `A<->B` jika `shared >= minShared`, `totalCount >= dupCount`.

## When to use me

Gunakan skill ini ketika:
- Perlu baca status/sync duplikat Immich (`/api/health`, `/api/sync`).
- Perlu cari folder duplikat H2H (`/api/clusters?minShared=5`, `/api/folders/overlaps`, `/api/duplicates`, `/api/folders`).
- Perlu trash hasil H2H (`POST /api/decisions/resolve`, `GET /api/decisions`) dengan `dryRun` dulu.
- Perlu tampilkan/playback media (`/api/thumb/:id`, `/api/video/:id`, `/api/original/:id`).

Jangan gunakan untuk API Immich asli — ini API wrapper sorter saja.

## Base URL & env

- Default: `http://localhost:3000` (`bun run server.ts` di folder sorter).
- Env sorter (`.env`): `IMMICH_BASE_URL=http://localhost:2283/api`, `IMMICH_API_KEY=...`, `PORT=3000`, `DB_PATH=./sorter.db`.
- Dari repo ini: set `SORTER_BASE_URL=http://localhost:3000` (atau URL deploy sorter).
- CORS sorter terbuka (`*`), preflight `OPTIONS` → `204`.

## Endpoints

### 1. GET /api/health — DB stats + lastSync
```bash
curl http://localhost:3000/api/health
# {"ok":true,"lastSyncAt":1710000000000|null,"dbGroups":6,"dbAssets":17,"version":"1.0.0"}
```
Sumber: `server.ts:125`. Jika `lastSyncAt=null` → belum pernah sync.

### 2. POST /api/sync — sync getAssetDuplicates() → SQLite
```bash
curl -X POST http://localhost:3000/api/sync
# {"ok":true,"groups":6,"assets":17,"folders":3,"durationMs":123}
```
- Menghapus orphan groups/assets, upsert `folders.totalCount` via `getUniqueOriginalPaths()` + fallback lokal (`services/sync.ts:13`).
- Selalu panggil ini dulu sebelum `clusters` jika data basi.

### 3. GET /api/duplicates?limit=50&offset=0
```bash
curl "http://localhost:3000/api/duplicates?limit=50&offset=0"
# {"total":6,"limit":50,"offset":0,"groups":[{"duplicateId":"dup-1","syncedAt":...,"assets":[...]}]}
```
`limit` di-clamp max `200` (`server.ts:148`).

### 4. GET /api/folders
```bash
curl http://localhost:3000/api/folders
# {"folders":[{"path":"a/b/c","totalCount":10,"lastCountedAt":...}]}
```
`totalCount=null` = belum terhitung, `< dupCount` = stale (akan dihitung ulang).

### 5. GET /api/clusters?minShared=5 — utama H2H
```bash
curl "http://localhost:3000/api/clusters?minShared=5"
# {"minShared":5,"count":1,"clusters":[{"clusterId":"...","folders":[{"path":"a/b/c","dupCount":6,"totalCount":6}],"edges":[{"folderA":"a/b/c","folderB":"z/x/c","sharedCount":6,"jaccard":0.5}],"sharedGroups":[{"duplicateId":"dup-1","assets":[...]}],"totalShared":6,"maxShared":6}]}
```
- `computeClusters()` di `services/grouping.ts:32`: pair → filter `>=minShared` → connected components → sort by `maxShared desc`.
- Response ini sudah di-enrich: tiap `sharedGroups` berisi full `assets` (`server.ts:173-181`).
- Turunkan `minShared=1|2` untuk debug, default produksi `5`.

### 6. GET /api/folders/overlaps?minShared=5 — alias legacy
Return `{minShared, clusters, pairs[]}` dimana `pairs` = flat `edges` (`server.ts:189`).

### 7. POST /api/decisions/resolve — soft-trash
```bash
curl -X POST http://localhost:3000/api/decisions/resolve \
  -H "Content-Type: application/json" \
  -d '{"groups":[{"duplicateId":"dup-1","keepAssetIds":["a1"],"trashAssetIds":["b1"]}],"action":"keep:a/b/c","dryRun":true}'
# dryRun: {"ok":true,"dryRun":true,"groups":[...]}
# real:   {"ok":true,"result":{...},"groups":[...]}
```
- Validasi: `groups` wajib non-empty array, else `400 {"error":"groups required"}`.
- Flow: insert `decisions(status=pending)` → `dryRun? status=dryRun : resolveDuplicates({groups})` → `done` + `duplicate_groups.resolved=1`, gagal → `status=error` (`server.ts:208-261`).
- Selalu `dryRun:true` dulu dari UI (`public/app.js:209`).
- Payload per grup dibangun per folder: asset yang folder-nya tidak di `keepSet` → `trash`; hanya kirim grup dengan `trash.length>0`; jika `keep` kosong fallback keep 1 asset pertama.

### 8. GET /api/decisions — history
```bash
curl http://localhost:3000/api/decisions
# {"decisions":[{"id":1,"duplicateId":"dup-1","keepAssetIds":"[...]","trashAssetIds":"[...]","action":"...","decidedAt":...,"status":"done|dryRun|pending|error"}]}
```
Limit 100, order `decidedAt DESC`.

### 9. Media proxy
```bash
curl "http://localhost:3000/api/thumb/<assetId>?size=thumbnail" -o t.jpg   # size=thumbnail|preview
curl "http://localhost:3000/api/video/<assetId>" -o v.mp4
curl "http://localhost:3000/api/original/<assetId>" -o o.jpg
```
- Foto: `<img src="/api/thumb/...">`, video: `<video poster="/api/thumb/..." src="/api/video/...">`.
- Thumb/video kirim `Cache-Control: public, max-age=3600`.

## Contoh pakai dari Elysia (repo ini)

```ts
const SORTER = process.env.SORTER_BASE_URL ?? 'http://localhost:3000';

// health gate sebelum clusters
const h = await fetch(`${SORTER}/api/health`).then(r => r.json());
if (!h.dbGroups) await fetch(`${SORTER}/api/sync`, { method: 'POST' });

// clusters
const { clusters } = await fetch(`${SORTER}/api/clusters?minShared=5`).then(r => r.json());

// resolve (dryRun dulu)
const res = await fetch(`${SORTER}/api/decisions/resolve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ groups: [{ duplicateId: 'dup-1', keepAssetIds: ['a1'], trashAssetIds: ['b1'] }], dryRun: true })
}).then(r => r.json());
```

## CLI sorter (referensi, bukan API)

```bash
bun run server.ts                 # WebView + API :3000
bun run index.ts --sync           # sync -> sorter.db
bun run index.ts --clusters 5     # cetak cluster minShared=5
bun run index.ts --seed-demo      # seed a/b/c vs z/x/c vs m/n/c untuk test tanpa Immich
bunx tsc --noEmit --skipLibCheck  # verifikasi tipe
```

## Gotchas

- `totalCount` lazy: jika `null` atau `< dupCount`, anggap stale — trigger `POST /api/sync`.
- `folderOf()` normalisasi `\` → `/`, strip trailing slash (`services/folder.ts:7`).
- `pairKey` sorted `a|b` agar tidak dobel; `jaccard = shared / |union|`.
- `resolve` tanpa `dryRun` langsung soft-trash di Immich — tidak bisa undo dari sorter.
- File sumber: `server.ts`, `services/sync.ts`, `services/grouping.ts`, `services/folder.ts`, `services/immich.ts`, `db.ts`, `public/app.js`.
