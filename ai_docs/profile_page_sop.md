# Profile / Settings Page — Developer SOP

## Purpose and business context

The Profile page (`/profile`, sidebar "Settings") lets an authenticated user view their
HR-managed identity data and self-service-update a small set of personal contact fields.
This iteration was a UI/UX redesign to the CDS Business reference design; no backend
behavior, permission, or API contract was changed.

## What was built

`frontend/src/features/profile.tsx` was rewritten from a narrow single-column layout into
the reference two-column design:

1. **Page header** — custom `My profile` title (1.75rem / weight 800) plus the muted
   subtitle "Manage your personal information and account settings".
2. **Profile hero card** — full-width card with a warm tint (`alpha(primary, 0.06)`),
   16px radius, a 76px circular initials avatar, the user's real name, `email • job title`,
   and a small role `Chip`. There is **no** "Change photo" button: the `Profile` model and
   API have no photo field or upload endpoint, so the button was intentionally omitted
   (spec required omitting it rather than faking it).
3. **Left card — Personal details** — `IconBadge` header, divider, and five read-only
   label/value rows (Name, Email, Job title, Department, Hire date) with subtle row
   separators. Missing values render `—`. Bottom info callout: "HR-managed fields can only
   be updated by HR."
4. **Right card — Editable fields** — `IconBadge` header, divider, three labeled inputs
   (Phone number, Address, Personal email) at 54px height / 10px radius with inline-start
   icons (phone / location / mail). Buttons: primary red **Save changes** (disabled while
   the form is pristine — `formState.isDirty` — or while saving) and outlined **Cancel**
   (`reset()` to the last-saved defaults, no API call). Success `Alert` and `ErrorAlert`
   preserved.
5. **Password section** — inside the bottom of the right card, after a divider: lock
   `IconBadge`, "Password / Keep your account secure", and an outlined red **Change
   password** button that navigates to the existing `/change-password` route. No modal,
   no new endpoint.

## API and logic

- Update: `PATCH /api/me/profile/` with `{phone, address, personal_email}` via the shared
  `patch` helper; `onSuccess` calls `refreshUser()` so the auth context and hero card
  reflect saved values.
- Form: `react-hook-form`; `defaultValues` derived from `user.profile`; a `useEffect`
  re-`reset()`s when the user object changes (e.g., after save).
- Read-only fields (`first_name`, `last_name`, `job_title`, `department`, `hire_date`,
  `email`) are display-only for every role; the backend enforces this — the UI change did
  not alter what is editable.

## Security / permissions

- Route remains authenticated-only; no permission or scope changes.
- HR-managed fields are not rendered as inputs for any role, matching backend rules.
- Password change reuses the existing flow; no new auth surface was added.

## i18n / RTL / theme

- New keys under `profile.*` in `en.json` and `ar.json`: `subtitle`, `detailsSubtitle`,
  `editableSubtitle`, `phonePlaceholder`, `addressPlaceholder`, `personalEmailPlaceholder`,
  `saveChanges`, `passwordTitle`, `passwordSubtitle`. Existing keys kept.
- RTL verified: hero, card order, label alignment, input adornments, and buttons mirror
  correctly (MUI RTL cache + logical-direction layout).
- Dark mode: hero tint, card surfaces, borders, callout, inputs, and role chip all adapt
  via theme palette/alpha — verified in browser.

## Responsive

- `lg+`: 46fr / 54fr two-column grid; hero stays full width.
- `xs–md`: single column — hero, then Personal details, then Editable fields + password.
- No horizontal overflow at 390px.

## Test scenarios

- Happy path: edit Phone → Save changes → success alert → values persist after reload;
  Cancel on dirty form restores last-saved values with no network call.
- Edge: Save disabled while pristine; partial values (e.g., only personal email) patch
  cleanly; missing department/hire date show `—`.
- Permission: EMPLOYEE cannot edit HR-managed fields (no inputs rendered; PATCH would be
  rejected server-side regardless).
- Verified: real save round-trip in browser, `/change-password` navigation, EN + AR/RTL,
  light + dark, 1920×1080 / 1440×900 / 390px.

## Known limitations

- No profile photo upload — initials avatar only.
- `department` / `hire_date` are plain read-only display fields (no selectable list).
- Success feedback is an inline `Alert`, not a toast (unchanged from prior behavior).
