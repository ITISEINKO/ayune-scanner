# Next project: Ginee integration blueprint

This document is for a barcode/warehouse app backed by Ginee Open API. It is
an implementation plan, not a copy of the current ClickUp code.

Official references:

- [Get Started](https://doc.ginee.com/_get_started.html)
- [List warehouse inventory](https://doc.ginee.com/api/warehouseInventory/_list_warehouse_inventory.html)
- [Get warehouse inventory](https://doc.ginee.com/api/warehouseInventory/_get_warehouse_inventory.html)
- [Adjust inventory](https://doc.ginee.com/api/warehouseInventory/_stock_update.html)
- [Webhooks](https://doc.ginee.com/_web_hooks.html)
- [Inventory integration best practice](https://doc.ginee.com/practice/inventory/_pull_inventory.html)

Checked against the official documentation on 2026-09-29.

## Provider facts

- Production host for Indonesia: `https://api.ginee.com`.
- Requests use `Content-Type: application/json`.
- Requests use `X-Advai-Country: ID`.
- `Authorization` is `{accessKey}:{base64(hmacSha256(secretKey, signText))}`.
- The signed text is `${HTTP_METHOD}$${requestPath}$`, for example
  `POST$/openapi/warehouse-inventory/v1/sku/list$`.
- A response must be checked for `code === "SUCCESS"`; HTTP status alone is
  not enough.
- Save `transactionId` in logs for support and troubleshooting.
- Common provider codes include `IAM_FAILED`, `PARAMETER_ERROR`, and
  `SERVICE_BUSY`.

## Environment variables

Use names like these in the next project:

```env
GINEE_API_BASE_URL=https://api.ginee.com
GINEE_ACCESS_KEY=...
GINEE_SECRET_KEY=...
GINEE_COUNTRY=ID
GINEE_WAREHOUSE_ID=...
```

Do not expose these values to client components or `NEXT_PUBLIC_*` variables.

## Suggested app contract

```text
GET  /api/inventory/search?sku=...
POST /api/inventory/adjust
```

Normalized response:

```ts
type InventoryItem = {
  inventoryId: string;
  warehouseId: string;
  masterSku: string;
  name: string;
  variationName: string;
  availableStock: number;
  warehouseStock: number;
  warehouseName: string;
};
```

The UI should use this shape rather than Ginee's nested `data.content` or
`warehouseInventory` objects.

## Read flow

For a scanned SKU, call:

```http
POST /openapi/warehouse-inventory/v1/sku/list
```

Body:

```json
{
  "page": 0,
  "size": 50,
  "warehouseId": "WW...",
  "masterSkuList": ["SKU-001"]
}
```

Use the documented page size limit, stop when all pages are consumed, and
return `404` from the app route when no matching item exists. If the app needs
one exact inventory record after the list result, call:

```http
GET /openapi/warehouse-inventory/v1/sku/get?id=WI...
```

The useful fields are nested under `data.warehouseInventory`,
`data.masterVariation`, and `data.warehouse`.

## Write flow: important semantic difference

Ginee's `AdjustInventory` endpoint sets inventory to an absolute quantity; it
does not receive an `IN`/`OUT` delta:

```http
POST /openapi/warehouse-inventory/v1/product/stock/update
```

Body:

```json
{
  "warehouseId": "WW...",
  "stockList": [
    {
      "masterSku": "SKU-001",
      "quantity": 30,
      "remark": "manual adjustment"
    }
  ]
}
```

The provider documents 1–20 stock items per request and a quantity from 0 to
less than 999999.

If the UI still offers `IN` and `OUT`:

1. Re-read the authoritative inventory on the server.
2. Calculate `target = current + qty` for `IN` or `current - qty` for `OUT`.
3. Reject a negative target and provider-range violations.
4. Send the absolute `target` to `AdjustInventory`.
5. Return the provider's resulting stock, not the browser's calculation.

This read-then-write flow can lose a concurrent update. Prefer a Ginee-native
inbound/outbound operation if the business flow is an actual movement rather
than a correction. If adjustment is the only available operation, record the
operator, source stock, target stock, and Ginee `transactionId` for audit and
reconciliation.

## Adapter shape

Keep the Ginee-specific code in a small server-only module:

```text
src/lib/ginee/client.ts       sign requests, fetch, parse response codes
src/lib/ginee/inventory.ts    list, get, and adjust inventory
src/lib/inventory.ts          app-owned types and stock rules
src/app/api/inventory/...     validate and map the HTTP contract
```

The client should have one signing function and one response parser. Route
handlers should not build signatures or inspect nested Ginee response fields.

## Error mapping

| Ginee condition | App response |
| --- | --- |
| Missing/invalid SKU | `400` |
| No inventory match | `404` |
| Missing server configuration | `500` |
| `IAM_FAILED` | `502` and log configuration/auth detail server-side |
| `PARAMETER_ERROR` | `400` or `502`, depending on whether the app sent invalid data |
| `SERVICE_BUSY` or timeout | `503`, retry only when safe |
| `SUCCESS` | `200` |

Never return the access key, secret, signature, or raw provider response to the
browser.

## Webhooks

Ginee can send notifications for master products, orders, inbound orders, and
outbound orders. The documented setup uses one endpoint per module and
requires coordinating the endpoint with Ginee staff.

Start with pull-on-demand for the scanner. Add webhooks only when the app must
reflect external changes without a user refresh. When adding them:

- accept the common event fields `id`, `entity`, `action`, `createAt`, and
  `payload`;
- store the event ID before processing or otherwise deduplicate it;
- return quickly and make repeated delivery harmless;
- do not assume webhook payloads are a replacement for a fresh inventory read.

## Build order

1. Confirm the Ginee account, access key, secret key, country, and warehouse.
2. Implement and self-check request signing.
3. Implement `ListWarehouseInventory` for one SKU and one warehouse.
4. Normalize the response into `InventoryItem`.
5. Implement the barcode search route and UI.
6. Add a read-before-adjust transaction route only if adjustment semantics are
   acceptable.
7. Test provider error codes, pagination, negative stock, concurrent changes,
   and retries.
8. Add webhook synchronization only after the pull flow is reliable.
