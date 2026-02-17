# Theo Mode Entitlement Plan

## Goal

Make Theo mode org-scoped and server-controlled, with strict write access limited to a flagged manager user (Theo), while all non-eligible users stay in default behavior by default.

## Desired Behavior

- Everyone defaults to non-Theo mode.
- Theo mode is visible/active for all members only in orgs where org Theo mode is enabled.
- Only Theo can enable/disable org Theo mode.
- No client-only trust: server enforces all gating.

## Data Model

- `modeSettings` (existing): stores org-level Theo mode state.
- `userFlags` (new): server-only per-user entitlements.
  - `userId`
  - `canManageTheoMode`
  - `updatedAt`, `updatedBy`

## Server Enforcement

1. Add shared mode utilities:
   - org-only effective mode resolution
   - user entitlement check (`canManageTheoMode`)
   - centralized status/field sanitization for default mode
2. Update mode query:
   - returns effective mode + capabilities
   - includes `canManageTheoMode` flag for UI
3. Update mode mutation:
   - org context required
   - org admin required
   - `userFlags.canManageTheoMode` required
4. Keep existing Theo/Notion paths gated by effective org mode.

## UI Behavior

- Non-manager users do not see Theo mode toggle in settings.
- Theo mode UI/features still appear for org members when org Theo mode is enabled.

## Validation

- Run `bunx convex codegen`
- Run `bun run format`
- Run `bun run check`
- Run `bun run type-check`

## Checklist

- [x] Add `userFlags` table to schema.
- [x] Add entitlement helpers in shared mode utility.
- [x] Make mode resolution org-only by default.
- [x] Gate `setTheoMode` with admin + entitlement checks.
- [x] Return `canManageTheoMode` capability from mode query.
- [x] Hide Theo toggle in settings for non-manager users.
- [x] Regenerate Convex types.
- [x] Run formatting, lint, and type checks.
