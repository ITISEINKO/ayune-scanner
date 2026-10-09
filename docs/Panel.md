Get Member List
https://api.clickup.com/api/v3/workspaces/90182186539/chat/channels/2kzmdxhb-693718/members

To-do list

- [v] Confirm target ClickUp channel and target list/folder.
  - Add env values instead of hardcoding:CLICKUP_CHAT_WORKSPACE_ID=
    CLICKUP_CHAT_CHANNEL_ID=
  - Do not reuse the current production channel ID.
- [ ] Confirm the target custom field.
  - Verify whether the new channel uses STATUS BARANG SCAN or the existing Tahap Produksi.
  - Use option names/IDs from ClickUp dynamically; do not hardcode the JSON options.
- [ ] Add a server-side helper in src/lib/session.ts.
  - Read the current ClickUp token.
  - Call /api/v2/user.
  - Return the authenticated ClickUp user ID.
  - Never trust user_id or operator_id from the browser.
- [ ] Add channel-member loading.
  - Call the existing channel-members endpoint from docs/Panel.md.
  - Return member ID, username, and avatar.
  - Verify the logged-in user belongs to the configured channel.
- [ ] Decide where user permissions are stored.
  - The repository currently has no database/storage layer.
  - Do not use localStorage, in-memory variables, or a local JSON file in production.
  - Reuse an existing database if one exists; otherwise choose a small persistent ClickUp/config store before coding.
- [ ] Define one permission record per ClickUp user:
      {
      clickupUserId: string;
      menus: string[];
      allowedStatusOptionId?: string;
      }
- [ ] Add admin-only API endpoints.
  - List channel members and current permissions.
  - Grant/revoke menu access.
  - Assign exactly one status option per user.
  - Allow only users with role SUPER_ADMIN in ppic_permissions.
- [ ] Enforce permissions on the server first.
  - Protect /api/find-task.
  - Validate that the requested status is allowed for the authenticated user.
  - Example:
    - User A: only BARANG DITERIMA.
    - User B: only SEDANG DIPACKING.
  - Users cannot bypass this by manually calling the API.
- [ ] Implement the settings screen using the existing files:
  - src/features/settings/index.tsx
  - src/app/settings/page.tsx
  - Show channel members.
  - Show each user’s allowed menu.
  - Show each user’s allowed status.
  - Hide the settings menu from non-super-admins.
- [ ] Update navigation.
  - Keep the existing menu structure.
  - Render only menus allowed for the logged-in user:
    - Auto
    - Manual
    - Find
    - Settings
  - Page/API guards must remain active even if a menu is hidden.
- [ ] Add the smallest permission test.
  - Test super admin access.
  - Test a user limited to BARANG DITERIMA.
  - Test a user limited to SEDANG DIPACKING.
  - Test a non-channel member being rejected.
- [ ] Verify gradually:
      pnpm test
      npx tsc --noEmit
      pnpm build
- [ ] Roll out in this order:
  1. User detection.
  2. Channel-member detection.
  3. Super-admin guard.
  4. Permission storage.
  5. Server-side enforcement.
  6. Settings UI.
  7. Menu filtering.
  8. Production channel switch.
