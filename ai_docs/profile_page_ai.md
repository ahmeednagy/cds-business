## MODULE: profile_page (frontend features/profile)
## VERSION: 1.0
## LAST_UPDATED: 2026-10-12

### API
- GET current user via auth context (useAuth → user + user.profile)
- PATCH /api/me/profile/ → updates {phone, address, personal_email} only; onSuccess → refreshUser()
- No profile-photo endpoint exists — avatar is initials-only (first+last name initials, fallback first email char)
- Change password is a separate existing route /change-password (not part of this page's API)

### DATA
- Editable (PATCH): phone, address, personal_email
- HR-managed read-only display: first_name, last_name, job_title, department, hire_date
- user.email displayed read-only; user.role drives the role chip label (common.roles.*)
- Missing values render "—" (common.empty)

### VIEW (frontend/src/features/profile.tsx)
- Route /profile; sidebar "Settings" stays active
- Custom header: title 1.75rem/800 + subtitle (profile.subtitle)
- Hero card: full width, alpha(primary,0.06) tint, 16px radius, 76px red initials Avatar, name + "email • job title" + role Chip; no Change photo button (unsupported)
- Grid: xs 1fr → lg minmax(0,46fr)/minmax(0,54fr)
- Left card "Personal details": IconBadge header + divider + 5 label/value rows (muted label / strong value, row separators) + info callout (profile.hrManagedNote)
- Right card "Editable fields": IconBadge header + divider + 3 labeled TextFields (54px, 10px radius, startAdornment icons phone/location/mail)
- Buttons row: Save changes (primary red, disabled unless formState.isDirty || save.isPending) + Cancel (outlined, reset() to defaults)
- Password section: divider + IconBadge lock + "Password / Keep your account secure" + outlined red button → navigate("/change-password")
- Success Alert (profile.saved) + ErrorAlert on mutation error
- cardHeader() helper: IconBadge + title + subtitle; inputSx const shared by all 3 fields

### FORM
- react-hook-form; defaultValues from profile fields; useEffect re-resets on user change
- Cancel calls reset() with last-saved values — no API call
- Save disabled when pristine (existing behavior preserved)

### I18N KEYS (profile.*)
- title, subtitle, details, detailsSubtitle, editableFields, editableSubtitle
- name, email(common), jobTitle, department, hireDate, hrManagedNote
- phone, address, personalEmail + *Placeholder variants
- saveChanges, cancel(common), saved, changePassword, passwordTitle, passwordSubtitle
- All keys exist in en.json + ar.json

### DEPENDENCIES
- @mui/material (Card, Avatar, Chip, Divider, TextField, InputAdornment, alpha) → layout
- components/ui.tsx → IconBadge, ErrorAlert, LoadingState
- lib/api → patch | lib/auth → useAuth | react-router → useNavigate

### KNOWN_CONSTRAINTS
- No photo upload support — intentionally no Change photo control
- HR-managed fields never editable regardless of role (backend enforces)
- Profile model has no department FK to a selectable list — display only
- Success alert is ephemeral Alert (not toast) — consistent with prior behavior

### CHANGE_LOG
- 2026-10-12 | Redesigned to CDS reference: hero card, 46/54 two-column cards, icon-adorned inputs, password section, EN+AR keys added
