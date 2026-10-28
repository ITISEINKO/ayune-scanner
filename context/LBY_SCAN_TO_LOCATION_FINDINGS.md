# LBY scan-to-location feasibility

Inspected live on 2026-10-27 using the shared visitor project, then validated the downloaded responses offline. A lightweight, authenticated location viewer was subsequently implemented locally (see below). No vendor writes were made.

## Result

All **231 panel records match exactly one of 231 `BasePlankModel` objects**. The join already exists in the vendor data:

```text
panel.laberNumber (barcode/label number)
  -> panel.splitId
  == document.models[].id (className: BasePlankModel)
```

There are no missing matches, duplicate barcodes, duplicate panel split IDs, or duplicate model panel IDs in this snapshot. This proves an exact data mapping for this project. Physical sticker scans and full CAD rendering fidelity remain unverified; the simplified location viewer has separate local verification below.

| Room          | Matched panels |
| ------------- | -------------: |
| MIMBAR        |             15 |
| KITCHEN SET   |            112 |
| PANEL SINK    |              7 |
| KABINET-01    |             53 |
| ENTRANCE DOOR |             44 |
| Total         |            231 |

## Concrete example

| Field                  | Value                  |
| ---------------------- | ---------------------- |
| `laberNumber`          | `15370046368`          |
| `splitId` / model `id` | `fXr3DZjhz6bUagma6WNt` |
| Panel name             | `底板` (bottom panel)  |
| Room                   | `MIMBAR`               |
| Cabinet name           | `未命名` (unnamed)     |
| Room panel number      | `1`                    |
| Finished dimensions    | `270 × 300.83 × 19`    |
| Model document ID      | `mrSSUuf8ny7fVKa7eFOj` |
| Model size             | `[270, 300.83, 19]`    |

The live viewer material table also showed this label number and dimensions; selecting its row displayed panel number 1. Model highlighting/rotation was not reliably established through browser automation.

## Sources and format

Observed requests on `https://www.lbyerp.com`:

- `GET /api/erp/anyTenant/app/getPlankByOrderId/{orderId}`: HTTP 200, `code: 0`, 231 panel records.
- `GET /api/cd/anyTenant/app/getByOrderId/{orderId}`: HTTP 200, `code: 0`, a signed model archive URL.
- The archive download returned HTTP 200 and was 791,405 bytes. It contains one JSON file, 11,610,369 bytes uncompressed, with five documents.

These are observed internal endpoints, not a documented integration contract. No cookies or authentication headers were supplied by the inspection requests. Do not embed the shared visitor token or the expiring signed archive URL in committed files.

The model is vendor CAD JSON, rather than a ready-to-load GLB. Panel objects contain `lineModels`, `plankThickness`, `position`, `quaternion`, `scale`, `transMatrix`, and `parentId`. The inspected panels contain 926 outline segments, all `LineModel` instances. A renderer/converter still needs to validate outline extrusion, coordinate units, transforms, and parent hierarchy. Raw transforms in the mapping are not verified world-space installation coordinates.

## Saved mapping and runnable check

- `context/LBY_PANEL_MAPPING.json`: all 231 label-to-object matches, room names, dimensions, and raw model transforms. Financial fields, signed URLs, and visitor tokens are excluded.
- `scripts/map-lby-panels.cjs`: dependency-free offline mapping generator with assertions. It validates IDs and transform vectors before writing any output.

```powershell
node scripts/map-lby-panels.cjs "$env:TEMP\trackerprod-lby-inspection\panels.txt" "$env:TEMP\trackerprod-lby-inspection\geometry.json" context/LBY_PANEL_MAPPING.json
```

The source downloads are temporary local inspection files, not repository fixtures. To rerun elsewhere, supply the panel response and extracted model JSON as the first two arguments.

Validation passed for the actual 231 records. Negative checks confirmed that a missing model match and duplicate barcode are rejected before output is written.

## Implementation decision

Data-level scan-to-location is feasible for this project without manually pairing each panel. The simplified renderer described below now provides a locally tested deep link; a physical barcode and installation-side comparison remain follow-up checks.

If that proof passes, import and persist the model plus this mapping once per project/design revision. Runtime scans should resolve the barcode against the saved project mapping and highlight the matching object in an already-loaded model. Use a separate read-only lookup flow; the existing member scanner changes production status.

Still unverified: other project models, physical labels, production design revision handling, vendor access stability, full rendering fidelity, and real-device load time. No production deployment was tested.

## Direct-link auto-selection test

Follow-up inspection on 2026-10-27 tested the simpler option of opening the existing vendor viewer in a new tab and selecting a panel through the URL.

- The active `/cadVisitor` route loads `assets/index-24da2794.js` in the inspected build. Its two initialization handlers read only `query.token`, validate/decode that token, and obtain the order ID from the decoded data. Neither handler reads a barcode or split ID parameter.
- Room initialization selects the first room and all cabinets. It does not resolve an initial panel from the URL.
- Table row selection resolves the panel record by row ID, then invokes the existing `threeRef.selectedColorChange(record.splitId)` function. That function compares the supplied ID to mesh `userData.modelId` and changes materials.
- No `postMessage` receiver, `URLSearchParams`, or `location` access was found in this route bundle. This observation is scoped to this bundle/build; it is not a claim about every other vendor module or future version.
- A fresh tab was opened with the original visitor link plus `laberNumber=15370046372`. The model loaded in `MIMBAR/全部`, with no panel details selected and the material table closed. The extra parameter did not select a panel.
- After opening material details and clicking the exact `15370046372` row, the row became selected and the header showed `左侧板`, `421 * 202 * 19`, and panel number `5`. The URL stayed unchanged. This selected state resulted from a UI click, not the URL parameter.

**Conclusion:** a new-tab link is supported for opening the project, but direct panel selection through the tested URL is not supported by the inspected visitor implementation. The smallest vendor-side change would resolve a barcode/split ID after loading, select the correct room/cabinet, and call the existing highlight function. Without vendor changes, a browser extension/userscript could automate the existing table interaction; this has not been implemented or tested. A normal TrackerProd page cannot directly operate a cross-origin viewer tab's DOM.

No token or complete visitor URL is saved here. The downloaded vendor bundles remain temporary inspection files outside the repository.

## Other-project availability check

On 2026-10-27, a read-only ClickUp check returned all 16 parent projects with status `in progress` (`last_page: true`). None of their returned custom-field values contained an LBY viewer link. Detailed task responses were also inspected for `AY-21369 PLAFON FIORDINI FIB NO.66 Lt.2 (KAMAR 5)` and `AY-20678 AMETHYST 58 - KAMAR LT.4`: neither response contained an LBY link, including the returned descriptions, fields, attachment references, and subtask summaries. Their `Model`, `DESAINER 3D RENDER`, and `DESAINER 3D SKETCHUP` fields were unset.

The user confirmed that only the original visitor link is available. Its viewer derives the order ID from the validated token; changing the address text does not select another order. Therefore no second project could be opened with the currently available references. This does not establish that other projects lack models. Attachment contents, full descendant tasks, closed/Todo projects, and a vendor account's project browser were not inspected. No order IDs were guessed or access tokens altered.

### Network lookup for another known project

A further source-grounded network check found the vendor's order search definition in `lgcOrderInfo-1ba94c8a.js`: `POST /api/erp/lgcOrderInfo/page`. The active order-list component uses this API, with an `orderNo` search field. Known related order numbers were obtained read-only from ClickUp: `2610-00000179` for AY-21369 and `2609-00000159` for AY-20678.

One bounded read-only search was sent for `2610-00000179` with `{ "current": 1, "size": 1, "model": { "orderNo": "2610-00000179" } }`, without LBY login credentials. It returned **HTTP 401**, application `code: 401`, `isSuccess: false`, and `msg: 解析用户身份错误，请重新登录！` (user identity could not be parsed; sign in again). No other order record or model was returned. The rejection establishes the missing valid LBY identity for this request; it does not validate the complete search contract or prove how an authenticated lookup would behave.

Network inspection is therefore useful and was performed. The available share link allows the tested project reads, but did not provide a logged-in identity for the general order search. Further verification of another project needs its own share link or a valid LBY account/session. No credentials were guessed, visitor tokens modified, or access restrictions bypassed.

## Implemented lightweight location viewer

Working local deep link (requires the app's existing login and current PPIC access):

```text
http://localhost:3000/panel-location?project=z96buhry4p&barcode=15370046376
```

- The barcode in the URL automatically selects the matching panel and room. Barcode `15370046376` selects panel 9 in MIMBAR without a UI click or browser extension.
- Rendering uses native SVG with rotatable 3D projection. It introduces no dependency, WebGL context, textures, fonts from the vendor, material detail, continuous render loop, or vendor API request. Pointer drag, keyboard arrows, rotate buttons, zoom and reset are supported.
- Panel boxes retain the vendor's `position`, quaternion and scale composed through the complete parent chain. This follows the vendor viewer's own fallback-box placement approach. Shapes omit cutouts, holes and curved edges; the selected panel is drawn on top of context so it stays visible through enclosing panels. This is an installation-location aid, not fabrication geometry or a dimensioned drawing.
- The sanitized snapshot is **55,995 bytes** for all 231 panels (7,698 bytes when gzip-compressed locally). Only the selected room is serialized to the client: MIMBAR has 15 panels, **3,519 bytes** of geometry JSON (644 bytes gzip). These are data sizes, not measurements of total page transfer or real-phone performance.
- Snapshot revision is `fbad68f9de99`, derived from sanitized content. Whitelisted panel fields are `barcode`, `roomName`, `panelNumber`, and eight world-space box corners rounded to 0.1 source units. No token, signed URL, prices, textures or full source CAD file are bundled.
- The server page checks the existing ClickUp cookie and signed PPIC session, then reads fresh PPIC access. Super admins and active members may view imported projects. Unknown projects and malformed parameters are rejected; unknown barcodes show an explicit message. Snapshot files live under `src/data`, not `public`.
- Only the known project is registered in this proof. Existing status scanners and the existing ClickUp scan-to-find flow are unchanged.

### Files and importing a replacement snapshot

- `src/app/panel-location/page.tsx`: authenticated route and project snapshot selection.
- `src/features/panel-location/PanelLocationViewer.tsx`: lightweight viewer and barcode lookup form.
- `src/lib/panelLocation.ts`: URL builder and orthographic projection.
- `src/data/panel-locations/z96buhry4p.json`: sanitized project snapshot, server-imported.
- `scripts/map-lby-panels.cjs`: optional fourth output argument produces location snapshots from the original downloaded responses. It rejects duplicate IDs, missing/cyclic parents and invalid transforms.

```powershell
node scripts/map-lby-panels.cjs "$env:TEMP\trackerprod-lby-inspection\panels.txt" "$env:TEMP\trackerprod-lby-inspection\geometry.json" context/LBY_PANEL_MAPPING.json src/data/panel-locations/z96buhry4p.json
```

Reuse the URL builder when wiring a barcode link into a scanner or project list:

```tsx
import { panelLocationUrl } from "@/lib/panelLocation";

<a href={panelLocationUrl(project.task_id, serialNumber)} target="_blank" rel="noopener noreferrer">
  Lihat posisi panel
</a>
```

Changing `barcode` selects another imported panel. The helper does not import model data into the calling page. Camera/keyboard scanner integration must also handle popup restrictions; it is not wired into the existing scanner in this proof.

### Link persistence and database recommendation

Generate the application link from the existing project task ID and barcode. There is no need to store a separate URL for every panel, and expiring vendor download URLs should not be the runtime link.

For multi-project production import, persist one active snapshot reference per project in the existing database: `project_task_id`, `snapshot_version`, `snapshot_key`, and `imported_at`. Store sanitized geometry as a private versioned object, for example `panel-locations/<project-task-id>/<version>.json`. Validate and upload a new object first, then replace the active DB reference. Links can stay stable while the active snapshot revision changes. If historical installation links must keep their old design, add an explicit version to the application URL and resolve that version instead.

The current proof uses a bundled server-side snapshot, with no database migration, object-storage dependency, or online importer. Adding another project currently requires importing and registering its sanitized snapshot in the server route. The metadata/object-storage scheme above is a recommendation, not implemented behavior.

### Verification

- `npm.cmd run build`: passed, including TypeScript and the `/panel-location` route.
- `node tests/panel-location.cjs`: passed. Offline checks cover transform composition with scaled/rotated parents, parent cycle/missing-parent rejection, duplicate barcode rejection, preservation of leading zeroes, whitelisted output, URL encoding and finite projections.
- Browser checks use a temporary local database and test-only signed identity. They cover direct selection of panel 9, room-only geometry, lookup through form submission, switching to a 112-panel room, pointer and keyboard rotation, reset/zoom, mobile overflow, invalid project/duplicate query handling, login redirect and fresh member deactivation.
- Browser requests stayed local; the test recorded zero external requests. Desktop and mobile screenshots were visually inspected (`test-results/panel-location-desktop.png` and `test-results/panel-location-mobile.png`).
- Physical installation accuracy, a hardware barcode scan, deployment, production auth, online importing and real mobile performance remain unverified.

### Hydration regression fix

The initial browser checks exercised the controls but did not fail on recoverable hydration errors. After a reported mismatch at the SVG `title`, the test was extended to collect browser `pageerror` events and hydration-related console errors. It reproduced React production error 418 on the original build.

The SVG title's interpolated JSX children were replaced with one template-literal string. The unchanged functional checks plus the new zero-hydration-error assertions then passed after `npm.cmd run build`. Direct loads and barcode changes remained functional. This follows React's guidance to supply a single string to `title`: https://react.dev/reference/react-dom/components/title#use-variables-in-the-title.

## SketchUp GLB trial: three instance serials

The supplied `public/mimbar-doang.glb` was inspected directly: **884,592 bytes**, glTF 2, generator `SimLab GLTF`, 70 nodes, 27 meshes, and four images. All three serials survived export in node names:

| Serial | Component node | Exported node name |
| --- | ---: | --- |
| 15370046368 | 26 | `Component#22_15370046368` |
| 15370046369 | 29 | `Component#23_15370046369` |
| 15370046370 | 31 | `Component#24_15370046370` |

SketchUp Instance values were entered as raw serials; the exporter concatenated definition and instance names. The importer matches an explicitly supplied serial list against an exact node name or `_serial` suffix. Matching geometry children belong to their enclosing tagged instance; this avoids treating each material mesh as a separate physical panel. The remaining untagged meshes are visual context with `barcode: null`, not invented serials.

`scripts/import-glb-locations.cjs` converts rigid static GLB scene bounds into the existing lightweight snapshot schema. It reads POSITION accessor bounds, composes matrix or translation/quaternion/scale through ancestors, converts glTF Y-up metres to viewer Z-up millimetres, and emits simple boxes. It does not fetch external buffers or textures and does not copy embedded images. Axis-aligned bounds within each tagged instance approximate cutouts and sloping surfaces. Source reference: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html (node transformations and POSITION bounds).

```powershell
node scripts/import-glb-locations.cjs public/mimbar-doang.glb src/data/panel-locations/mimbar-glb-trial.json MIMBAR 15370046368 15370046369 15370046370
```

The result is **26 boxes**, three searchable serials, **5,919 bytes**, revision `305d728acdd8`. It is registered under the separate allowlisted project key `mimbar-glb-trial`; the existing LBY snapshot remains available under its original project key.

Local trial links (existing login required):

- http://localhost:3000/panel-location?project=mimbar-glb-trial&barcode=15370046368
- http://localhost:3000/panel-location?project=mimbar-glb-trial&barcode=15370046369
- http://localhost:3000/panel-location?project=mimbar-glb-trial&barcode=15370046370

The shared panel type now permits a nullable barcode and optional geometry ID so untagged context cannot be searched as a panel and SVG keys stay unique. No production serial is assigned to those context boxes.

Verification: `node tests/glb-locations.cjs`, `npm.cmd run build`, `node tests/panel-location.cjs`, and `git diff --check` passed. Import tests cover matrix/TRS composition, units/axes, grouped material children, preserved leading zeroes, missing/duplicate serials, malformed GLB, missing bounds, cycles, finite geometry and equality with the generated real-file snapshot. Browser checks cover all three direct links, search retaining the trial project, explicit failure for an untagged serial, no hydration errors and zero external requests. All three trial screenshots were visually inspected (`test-results/glb-trial-<serial>.png`).

Only the three supplied labels are mapped. Physical label/location matching, online upload/import UI, and production deployment remain unverified. The original user-supplied GLB remains in its original `public` path; the runtime viewer uses only the sanitized server snapshot.

## Versioned share-link import

The recurring share-link workflow is now implemented in `scripts/import-lby-project.cjs`, with operational commands and storage details in [LBY_IMPORT.md](./LBY_IMPORT.md).

Import stages immutable sanitized `locations.json`, `mapping.json` and `manifest.json` under `src/data/panel-locations/imports/<project>/<revision>/`. It does not alter the active catalog. A separate checksum-checked activation command updates `catalog.json`; using an older saved revision performs rollback. The viewer resolves the allowlisted catalog entry after authorization, with no vendor request. Source tokens and expiring file URLs are not persisted.

The supplied FIORDINI share link yielded 377 exact panel/model matches across seven rooms. Its 93,172-byte viewer snapshot was activated as the new local project `z96buhr3eu`, version `76852806d469`. The original RUKO and GLB trial entries remain available. Example: http://localhost:3000/panel-location?project=z96buhr3eu&barcode=15370040711.

Validation passed: 24 importer HTTP calls through the local Postman simulation (including safe failure retention and rollback), GLB regression checks, production build/TypeScript, viewer browser checks and snapshot deployment tracing. The imported FIORDINI screenshot was inspected. No production deploy, Git commit, DB migration, or online uploader was performed.
