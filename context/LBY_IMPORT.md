# Import an LBY share link

This is a local CLI import workflow. It freezes a validated, sanitized copy of panel positions; the viewer never follows the vendor link at runtime. It does not modify the vendor order or automatically refresh saved data.

For the ADMIN project-badge dialog, persistent Turso candidates, preview/activation/rollback and Vercel Hobby configuration, see [LBY_WEB_IMPORT.md](./LBY_WEB_IMPORT.md). The CLI below remains available; an active DB revision takes precedence over its bundled catalog entry.

Admin scans on `/admin/ubah-manual` now open the saved panel location on a separate page with bottom navigation and the existing status-change drawer. See [ADMIN_MANUAL_LOCATION.md](./ADMIN_MANUAL_LOCATION.md) for the flow and API response.

## Import

From this repository, run:

```powershell
npm.cmd run import:lby -- z96buhr3eu
```

Paste the complete `https://www.lbyerp.com/#/cadVisitor?...` link at the prompt. The project key is the existing ClickUp project task ID (or another stable key you deliberately choose); the helper does not discover that association automatically. The link is read from standard input rather than being committed or supplied as a command-line argument.

The helper reads the order identity and expiry from the supplied share token using the observed public visitor format, requests panels and model data, downloads the model archive, checks its size/CRC/order identity, and reuses `map-lby-panels.cjs` to validate exact barcode-to-object mapping and parent transforms. Invalid or expired links, unsupported schemas/hosts, vendor errors, missing mappings and invalid coordinates fail without changing the active catalog.

No new dependency is required; tested with Node.js 22.23.4, including native `node:zlib.crc32`. The internal vendor protocol may change; the importer must then be updated from current evidence, rather than silently guessing data.

### Revision identity

Panel names are included in the sanitized snapshot and its revision hash. A name-only change stages a new immutable candidate, so corrected labels and name-based door classification can reach the viewer after explicit activation. Identical names and geometry still reuse the existing revision; older snapshots remain readable through their saved mappings.

### Curved geometry (2026-10-28)

New imports retain sanitized mesh vertices, faces and visible edges for drawn `genType: "01"` outlines (`LineModel`/`ArcModel`) and bent `genType: "02"` L/U panels (`arcType: "00"`/`"02"`). Bent panels use their formed cross-section and height, not their flattened manufacturing size. This follows the inspected vendor renderer's `GenPlankWithLineModels` origin normalization and `GenArcPlankShapeNoFlip` construction. Ordinary template panels retain their existing box representation. Parent transforms apply to both representations.

Curves are sampled within 0.25 source units before world-coordinate rounding to 0.1 units. Unsupported bent types, non-planar/open/disconnected outlines and excessive geometry reject the candidate; they do not replace active data. This is still a location viewer: holes, machining details, hardware and arbitrary template-generated curved solids are not a complete CAD export.

Existing immutable revisions keep their original box geometry. Import the same share link again in `/drafter`, open the new Preview, then activate the reviewed revision through the existing workflow. Revision-pinned links keep showing that pinned revision. Checks: `node tests/lby-geometry.cjs`, `node tests/panel-location.cjs` after building, and the existing Postman import simulation plus `node tests/lby-import.cjs`.

## Where data is saved

```text
src/data/panel-locations/
  catalog.json                         # Explicitly selected active version per project
  imports/
    <project-key>/
      <full SHA-256 revision>/
        locations.json                 # Sanitized viewer boxes and serials
        mapping.json                   # Serial-to-vendor-object audit mapping
        manifest.json                  # Project identity, checksums, counts, import time
```

The original share token, expiring signed download URL, prices, images and full source CAD data are not persisted. The archive is parsed in memory, not extracted to arbitrary filesystem paths. `locations.json` contains serial, room, panel number and eight world-space box corners. `mapping.json` retains the non-financial ID/name/dimension/transform audit fields.

Files under a revision directory are immutable to the CLI. Reimporting the same geometry reuses the saved revision and first import timestamp. A changed sanitized model gets a new directory; old versions remain available. The hash identifies sanitized viewer content, not every attribute of the vendor's original CAD model; the manifest separately records a SHA-256 of the source model JSON.

These files are outside `public`. Commit the sanitized files and catalog to Git for durable history/backup; the helper does not commit or push them. The current worktree's new files are not yet committed.

## Review and activate

Import prints the saved manifest and exact activation command. Inspect `manifest.json`, the mapping and Git diff, then run:

```powershell
npm.cmd run activate:panel-location -- z96buhr3eu <full-revision-printed-by-import>
```

Activation verifies saved checksums, rejects assigning a previously registered project key to a different vendor order, and atomically replaces only the catalog pointer. It makes no vendor requests. To roll back, run the same activation command with an older saved revision.

The app's route reads only allowlisted catalog entries and selected snapshot files, after its existing login/fresh PPIC checks. Next.js output-file tracing includes the snapshot data for `/panel-location`. In development the catalog change is picked up by Next; a production deployment needs a fresh build/deploy containing the updated files. This is a single-operator local CLI, not an online admin uploader or a concurrent registry service.

## Supplied FIORDINI link

The supplied link was imported and the new project entry activated locally on 2026-10-27:

- Project key: `z96buhr3eu`
- Vendor order ID: `734821999007760514`
- Name: `FIORDINI FIB NO.66  LANTAI 3`
- 377 panels, seven rooms, all matched to model objects.
- Viewer snapshot: 93,172 bytes; displayed version `76852806d469`.
- Full revision: `fa56c09c1bd10c6755b973b0e5366e312c399173d716cb1973db44fe1eb27062`.
- Example: `http://localhost:3000/panel-location?project=z96buhr3eu&barcode=15370040711`.

The previous RUKO snapshot remains available. No existing LBY project was replaced.

## Verification

```powershell
postman simulation run tests/lby-import.sim.yaml --port 4913 --output ndjson --no-history
# In a second terminal:
node tests/lby-import.cjs
npm.cmd run build
node tests/panel-location.cjs
```

The importer ran over 24 HTTP requests to the local Postman stand-in, covering successful ZIP import, identical-content reuse, changed geometry, explicit activation/rollback, retained active pointers on 429/missing match/wrong-order/corrupt CRC/unexpected host/non-finite coordinates, and refusal to activate tampered files. The single `lby` simulation member served panel/model/archive paths, with no silent members. Its synthetic fixtures follow observed envelopes; no vendor-provided Postman mock was used. Simulation preconditions and results are recorded in `tests/lby-import.context.md`.

A separate live import of the user's share link succeeded. Browser tests verified the imported FIORDINI link plus previous RUKO links, direct highlighting, no hydration errors, no external requests, and unchanged authorization behavior. Build and deployment-trace checks passed for all active snapshots. The FIORDINI screenshot was visually inspected.

Not established: production deployment, hardware/installation accuracy, future vendor compatibility, concurrent CLI activation, or independent off-machine backup. The online workflow now stores bounded compressed snapshots and active references in Turso; private object storage is not required for these lightweight imports. The CLI itself retains its single-operator file/catalog workflow.
