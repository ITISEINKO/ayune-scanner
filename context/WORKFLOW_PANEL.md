# Panel ClickUp field reference

Readable reference for the custom fields in ClickUp Panel list `1100830000000087`.

- Source response: `GET https://api.clickup.com/api/v2/list/1100830000000087/field`
- Application source of truth: `src/lib/produksiPanel.ts`
- Last checked against the saved ClickUp response: 21 October 2026

## Fields used by the application

| Application key | ClickUp field | Type | Field ID |
| --- | --- | --- | --- |
| `CF_PANEL.SERIAL_NUMBER` | Serial Number | short_text | `dd6c185c-bd28-4967-b238-f386e98a64c8` |
| `CF_PANEL.STATUS_BARANG_SCAN` | STATUS BARANG SCAN | drop_down | `3d3a2535-9d01-4ca2-8a51-9b2f9182857c` |
| `CF_PANEL.RELATED_ORDER_NUMBER` | Related Order Number | short_text | `31673008-1c8b-4eaf-bb20-f0399d1abdb1` |

> **Important:** ClickUp has two fields named `Serial Number`. The scanner uses the `short_text` field above, not the `number` field `5b095554-f69b-485f-a32b-7302f54727ea`.

## STATUS BARANG SCAN options

| Application key | ClickUp label | Option ID |
| --- | --- | --- |
| `BARANG_DITERIMA` | BARANG DITERIMA | `22619cd5-078e-4b12-a6d2-96d723eed52b` |
| `DALAM_PROSES_PRODUKSI` | DALAM PROSES PRODUKSI | `fd878d1e-914a-4b23-a1e5-1cbd4b1c666b` |
| `DRY_FIT` | DRY-FIT | `1d967710-7ecc-403a-b7d3-a31d0e461813` |
| `SEDANG_DIPACKING` | SEDANG DIPACKING | `65d0e134-287b-4612-a410-109c8d28b2c0` |
| `SIAP_DIKIRIM` | SIAP DIKIRIM | `500956c0-61b6-4b48-bd93-c4c2ac730b3d` |
| `DITERIMA_DI_LOKASI_TUJUAN` | DITERIMA DI LOKASI TUJUAN | `40606444-c7a7-44d5-934c-c84ffaf48678` |
| `TERPASANG_DIGUNAKAN` | TERPASANG / DIGUNAKAN | `4f941328-79fb-4594-b67e-542b87ccd502` |
| `DALAM_PROSES_RETUR` | DALAM PROSES RETUR | `dc6eef4c-6843-4043-9938-b14388511be0` |
| `DIHAPUSKAN` | DIHAPUSKAN | `b6401cdb-9ee9-4e7e-8b6b-32f90183626e` |

## Other custom fields

| Field | Type | Field ID |
| --- | --- | --- |
| Order Processing Time | date | `088a20c4-6006-4af7-a713-479f57666a6f` |
| Part List | short_text | `0a30f788-ce67-477b-8ddf-0b6a6c927af9` |
| Cut Panel Area (m²) | number | `0df93aa5-39d1-4489-beb4-508f802bb7f3` |
| Order Maker | drop_down | `0e5dd0de-df83-4b7c-b29e-0d1f1a79191a` |
| Cut Panel Quantity | number | `0ec15853-b28c-498a-844a-bae5d03f9866` |
| Material | short_text | `1b33d292-5e19-4379-a800-4ea241b8a23e` |
| Model | short_text | `2694be24-92c8-4051-a68a-8f797bdb4e40` |
| Cutting Length | number | `3e2b8512-f8a1-47a4-8cb5-b704dd5e97ff` |
| Specifications | short_text | `3fde1fb3-4721-4d98-af3f-decbb5e04593` |
| Quantity | number | `402d3cb3-c731-4052-902c-5ca1b5e3a268` |
| Part Name | short_text | `451b43b0-69f5-427c-9814-f4f1b6916e56` |
| Hardware Names | short_text | `48a8dcd7-0d4d-4e58-bc35-d7579c2b1390` |
| Serial Number | number | `5b095554-f69b-485f-a32b-7302f54727ea` |
| Associated Order Address | short_text | `5c583e6a-f604-4eb7-b3e0-cf593f4c3cd1` |
| Cutting Width | number | `646acd33-882a-4484-8ebb-d9c38edb8b9a` |
| Batch Number | short_text | `723dbfe3-77b2-4d2f-ac2d-8ebd8852ed1d` |
| Color | short_text | `7274c340-2bd9-43a1-827b-bb0195637d0a` |
| Edge Banding | short_text | `779d081a-de36-4a90-9b3e-2f885d82664d` |
| Parts List | short_text | `7a51515a-0e9a-418b-8d15-72551844b82d` |
| Remark | short_text | `7be7821d-7d05-4de8-8ea0-fd3deb4e9c38` |
| Kode HPL (sisi 2) | short_text | `8cb0b92a-e30f-4a5f-9080-bf2857a26d58` |
| Room | short_text | `93000bbe-18f5-4753-ac40-88c964a4f607` |
| Unit | short_text | `9caf3b58-1401-4582-bf1a-7a2565a7ce78` |
| DESAINER 3D SKETCHUP | attachment | `a071c0e3-e2c7-4c98-8190-399b0b22c4c0` |
| PROGRES PEKERJAAN | manual_progress | `a3f2cef5-afa2-42ad-b810-d92277ae26c0` |
| QC FOTO PROGRESS | attachment | `b56de678-fed9-4c34-8c62-bc875a9725e3` |
| Tebal (mm) | number | `b58c47b6-a761-454f-ac56-cbe157aaf7ad` |
| Cabinet | short_text | `b86955de-2d13-4df5-a86a-deb6ca42dbe2` |
| Full Sheet Quantity | number | `d484b149-52ce-4792-b551-6ed26fa5e49c` |
| MESIN | drop_down | `d9fb741c-da58-4337-a496-3e5677af7e54` |
| DESAINER 3D RENDER | attachment | `eca18267-611c-42a2-9322-137f7575cacd` |
| Kode HPL (sisi 1) | short_text | `fb5160be-7f2a-4e7d-b5c7-949ad8e09187` |

## Baseline fields

| Field | Type | Field ID |
| --- | --- | --- |
| BASELINE_due_date | multi_key (date) | `679e9ef8-fa97-4fd0-bc9e-831975ab019f` |
| Start Date Actual | date | `6942f915-be59-4727-8c1c-62065368fc55` |
| Due Date Actual | date | `6ae49cc3-6708-4d5a-9eaf-13130d121ebe` |
| BASELINE_start_date | multi_key (date) | `8fe272ee-4fca-40ba-9275-9590e6e01998` |
| BASELINE_status | multi_key (status) | `c6bba833-fa6a-4959-89fe-3aec82842547` |
| BASELINE_duration | multi_key (number) | `e35ec1ca-70c8-494b-bdee-45ba02eac079` |

## Other dropdown options

### Order Maker

| Label | Option ID |
| --- | --- |
| INTERIOR 1 | `266e36f0-e7c8-4bd7-8e44-d352b0dc0e6a` |
| INTERIOR 2 | `ae1d3e3e-948a-481f-88ec-33a8c0d971f2` |
| INTERIOR 3 | `db6cdfd3-557c-4416-ae1c-eb9195637d0a` |
| PT BYTE BEYOND PERSONA | `825cfa4c-2a38-49cf-9adb-0cd71e34fd10` |
| INTERIOR 4 | `cd527f96-4f8c-4ea9-9011-c24f02241233` |

### MESIN

| Label | Option ID |
| --- | --- |
| GLUE SPREADER | `36097032-f330-4097-a6b3-3cf7a4790400` |
| COLD PRESS | `81107581-cf35-4701-bd44-1c2469786620` |
| NESTING | `562b1782-c988-4c94-9282-1e94fcb608dc` |
| DRILLING | `41daef9b-409b-4d4e-afa5-fc4220da9294` |
| EDGEBANDING | `d587a882-e53d-454d-a432-fd222d229c8c` |

## Adding a new PPIC panel status

The panel status flow uses two different identifiers:

- The ClickUp dropdown option ID belongs in `STATUS_BARANG_SCAN` in `src/lib/produksiPanel.ts`.
- The application key (for example, `TERPASANG_DIGUNAKAN`) belongs in `PPIC_STATUSES` in `src/types/ppic.ts`.

For a status that gets its own scan page, update these places:

1. Add the ClickUp option ID and label to `STATUS_BARANG_SCAN` and `statusBarangScanOptions`.
2. Add the application key to `PPIC_STATUSES`; this controls database permission validation, signed sessions, and API authorization.
3. Add the key-to-route mapping in `ppicStatusPath`.
4. Add the route under `src/app/<status-route>/page.tsx` and call `requirePpicStatusAccess("<STATUS_KEY>")` before rendering the page.
5. Add the scan target to `src/app/api/panel/scan/route.ts`. The target must send the ClickUp option ID as the custom-field value.
6. Add the route and icon branch to `src/components/bottomNavigation.tsx`.
7. Add the status option to the admin list in `src/features/settings/index.tsx` so a super admin can assign it to a member.
8. Create the client page in `src/features/panel/` using the existing scanner flow: trim the serial number, POST to `/api/panel/scan`, show the returned item, and keep the existing error handling.
9. Add a path/status assertion to `src/lib/produksiPanel.test.ts`, then run `pnpm test` and `pnpm exec tsc --noEmit --pretty false`.

### Runtime flow

1. A super admin assigns one allowed status to a channel member in Settings.
2. The member receives that status in the signed PPIC session and is redirected by `ppicStatusPath`.
3. The guarded page renders the scanner only if the session status matches the route.
4. The scanner or manual input sends a serial number and application key to `/api/panel/scan`.
5. The API re-checks the member's current permission, finds the ClickUp task by `CF_PANEL.SERIAL_NUMBER`, and updates `CF_PANEL.STATUS_BARANG_SCAN` with the mapped ClickUp option ID.
6. A successful response opens the confirmation dialog; failures leave the ClickUp status unchanged.

For `TERPASANG / DIGUNAKAN`, the application key is `TERPASANG_DIGUNAKAN` and the ClickUp option ID is `4f941328-79fb-4594-b67e-542b87ccd502`.
