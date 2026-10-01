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
