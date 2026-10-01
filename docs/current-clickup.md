# Current project: ClickUp reference

Scannow is a barcode-driven warehouse scanner. The browser talks to local
Next.js routes; only the server talks to ClickUp.

## Current flow

```text
barcode
  -> GET /api/product/search?sku=...
  -> ClickUp master list
  -> normalized product drawer
  -> POST /api/stock/transaction
  -> ClickUp transaction log + master stock field
```

The relevant implementation is:

| Concern | Current location |
| --- | --- |
| ClickUp field lookup | `src/lib/clickup.ts` |
| Product search | `src/app/api/product/search/route.ts` |
| Product creation | `src/app/api/product/route.ts` |
| Stock transaction | `src/app/api/stock/transaction/route.ts` |
| Stock calculation | `src/lib/stock.ts` |
| Browser workflow | `src/app/page.tsx` |

## What to carry forward

- Keep the token on the server.
- Expose app-owned routes to the browser.
- Resolve provider fields in the integration layer.
- Normalize provider data before sending it to UI components.
- Keep stock arithmetic in a small domain helper.
- Validate the request before calling the provider.
- Return a stable `{ error: string }` shape for UI errors.

## What not to copy blindly

ClickUp stores the product as a task and stock as a custom field. Another
provider may use a warehouse inventory record, master variation, or SKU.
ClickUp also uses HTTP requests whose useful fields are provider-specific.
Keep those details in the adapter instead of shaping the next app around them.

For the next project, replace the ClickUp field-name lookup with provider
operations such as `findInventory`, `getInventory`, and `adjustInventory`.
