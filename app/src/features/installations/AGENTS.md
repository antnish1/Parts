# Engine & Breaker — Agent Contract

Read the repository root `AGENTS.md` first. These rules apply to `app/src/features/installations` and related installation service/database changes.

## Developer destructive override

The `developer` role may delete any Engine & Breaker entry at any workflow stage, including Pending, Acceptance Pending, and Accepted.

This is a privileged production override and must follow all of these rules:
- UI controls are visible only to `developer`.
- Backend permission is enforced by a security-definer RPC that independently verifies the authenticated active profile has role `developer`.
- Every delete requires a human-entered reason.
- Before the live entry is removed, a complete metadata snapshot (entry, items and document records) is written to `portal_developer_override_audit` so the action remains traceable after cascade deletion.
- The developer identity and timestamp are stored in the permanent audit row.
- Linked storage files should be removed after the database delete; if storage cleanup fails, tell the developer explicitly that the database entry was deleted but file cleanup needs attention.
- Do not extend delete permission to Manager, Admin, HQ, Viewer or branch roles without an explicit user instruction.

Normal Engine & Breaker creation, branch completion, Service CRM acceptance and report workflows must remain unchanged.
