# Scannow

Scannow is a mobile-friendly warehouse scanner. It reads a product barcode,
looks up the product in ClickUp, displays its inventory details, and records
stock-in or stock-out transactions.

## How the application works

```text
Barcode camera
    ↓
GET /api/product/search?sku=...
    ↓
ClickUp master list (find product by SKU / Barcode)
    ↓
Product drawer: name, brand, rack, current stock
    ↓
POST /api/stock/transaction
    ├─ create transaction task in the ClickUp log list
    └─ update Stok Saat Ini on the master product task
```

If the barcode is not found, the app opens the new-product form instead:

```text
POST /api/product
    ↓
Create product task in the ClickUp master list
    ↓
Show the new product in the product drawer
```

The ClickUp token is only used by the Next.js server. The browser calls the
local `/api/*` routes and never receives the token.

## Requirements

- Node.js
- pnpm 12+
- A ClickUp API token
- A ClickUp master list for products
- A ClickUp log list for stock transactions
- HTTPS (or localhost) for camera access

## Run locally

```bash
pnpm install
pnpm dev
```

`pnpm install` also runs the production build through the `postinstall` script.

Open `http://localhost:3000` and allow camera access. To check the product
drawer without a camera, open `/preview` while running in development mode.
The preview link is hidden outside development, but the route itself is not
production-protected.

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```env
CLICKUP_API_TOKEN=pk_your_clickup_token
CLICKUP_MASTER_LIST_ID=your_product_list_id
CLICKUP_LOG_LIST_ID=your_transaction_log_list_id
LIST_PRODUKSI_ID=your_produksi_list_id
CLICKUP_SPV_OPERATOR_IDS=OPR-001,OPR-002
FIELD_ID_SKU=your_sku_field_id
FIELD_ID_STOK=your_stock_field_id
FIELD_ID_RAK=your_rack_field_id
FIELD_ID_BRAND=your_brand_field_id
FIELD_ID_TIPE=your_transaction_type_field_id
FIELD_ID_QTY=your_quantity_field_id
```

The `FIELD_ID_*` variables are kept for configuration reference. The current
API implementation resolves ClickUp fields by their exact names at request
time, so these values are not read by the application.

Restart the dev server after changing `.env`.

## Production workshop API

The scanner backend is available at `POST /api/produksi/scan` and `GET /api/produksi/{barcode}`. It uses the ClickUp custom-field names from the production guideline, enforces its step/QC transitions, and only permits operators listed in `CLICKUP_SPV_OPERATOR_IDS` to release `Komplain`.

## ClickUp list setup

### Master/product list

Create these custom fields with these exact names:

| Field name      | Used for            | Value  |
| --------------- | ------------------- | ------ |
| `SKU / Barcode` | Product barcode/SKU | Text   |
| `Stok Saat Ini` | Current stock       | Number |
| `Lokasi Rak`    | Warehouse rack      | Text   |
| `Brand`         | Product brand       | Text   |

The ClickUp task name is the product name.

### Transaction log list

Create these custom fields with these exact names:

| Field name       | Used for        | Value    |
| ---------------- | --------------- | -------- |
| `Tipe Transaksi` | Stock direction | Dropdown |
| `Jumlah (Qty)`   | Quantity moved  | Number   |

The `Tipe Transaksi` dropdown must contain these options:

- `Barang Masuk` for `IN`
- `Barang Keluar` for `OUT`

The transaction task name is formatted as `<type> <sku> × <qty>`. Its
description contains the operator and optional notes.

## API reference

All routes are Next.js server routes under `src/app/api`.

### Search for a product

```http
GET /api/product/search?sku=1234567890123
```

The route searches every page of tasks in `CLICKUP_MASTER_LIST_ID` and compares
the `SKU / Barcode` custom-field value with the requested SKU.

Success (`200`):

```json
{
	"id": "86abc-task-id",
	"name": "Kopi Arabika 250 g",
	"sku": "1234567890123",
	"currentStock": 24,
	"rak": "A-03",
	"brand": "Nusantara"
}
```

Possible errors:

| Status | Meaning                                             |
| ------ | --------------------------------------------------- |
| `400`  | `sku` is missing                                    |
| `404`  | No product has that SKU                             |
| `500`  | ClickUp environment variables or fields are missing |
| `502`  | ClickUp could not be reached                        |

### Add a product

```http
POST /api/product
Content-Type: application/json
```

Request body:

```json
{
	"sku": "1234567890123",
	"name": "Kopi Arabika 250 g",
	"brand": "Nusantara",
	"rak": "A-03",
	"currentStock": 24
}
```

Required rules:

- `sku`, `name`, `brand`, and `rak` must not be blank.
- `currentStock` must be an integer greater than or equal to `0`.

Success (`200`) returns the created product in the same shape as the search
response, including the new ClickUp task `id`.

### Save a stock transaction

```http
POST /api/stock/transaction
Content-Type: application/json
```

Request body:

```json
{
	"taskId": "86abc-task-id",
	"sku": "1234567890123",
	"type": "OUT",
	"qty": 2,
	"operator": "Budi",
	"notes": "Order #1007",
	"currentStock": 24
}
```

Fields:

- `taskId`: ClickUp task ID from the product search response.
- `sku`: Product SKU used in the log task name.
- `type`: `IN` or `OUT`.
- `qty`: Positive integer.
- `operator`: Required operator name.
- `notes`: Optional text.
- `currentStock`: Stock value currently shown to the operator.

The new stock is calculated as:

```text
IN  → currentStock + qty
OUT → currentStock - qty
```

Stock may not become negative. On success (`200`):

```json
{
	"success": true,
	"newStock": 22
}
```

The route then updates both ClickUp records: it creates a transaction task in
the log list and updates `Stok Saat Ini` on the product task. A failed request
returns a ClickUp error and does not report success.

## Product display flow

The main page is `src/app/page.tsx`:

1. `Scanner` opens the device camera using `html5-qrcode`.
2. A successful scan stops the camera and sends the decoded text as the SKU.
3. `findProduct()` calls `GET /api/product/search`.
4. A found product is passed to `ProductSheet`.
5. `ProductSheet` displays the product name, brand, SKU, rack, and current stock.
6. The operator selects `Barang Masuk` or `Barang Keluar`, enters a quantity and
   name, then saves the transaction.
7. A successful save shows a confirmation and restarts the scanner.
8. A missing SKU opens `NewProductSheet`; after creation, the returned product
   is shown in `ProductSheet`.

The browser blocks product searches while it is offline. A save request can
fail if the connection drops. Camera access must be granted by the browser,
and production deployments must use HTTPS for camera access.

## Useful commands

```bash
pnpm dev       # development server
pnpm build     # production build
pnpm start     # start production server
```

## Project structure

```text
src/
├─ app/page.tsx                         Main scanner page
├─ app/api/product/search/route.ts      Find products in ClickUp
├─ app/api/product/route.ts              Create products in ClickUp
├─ app/api/stock/transaction/route.ts   Log and apply stock changes
├─ components/scanner.tsx                Camera UI
├─ components/product-sheet.tsx          Product and stock form
├─ components/new-product-sheet.tsx      New product form
├─ hooks/use-barcode-scanner.ts          Camera/scanner behavior
└─ lib/clickup.ts                        ClickUp field lookup helper
```
