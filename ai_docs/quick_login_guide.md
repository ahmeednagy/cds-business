# Quick Login — User Guide

## What it does
On the login page, three small cards let you sign in instantly as a demo
persona — no typing needed. This only appears on demo/development versions
of CDS Business.

## Prerequisites
Nothing to set up — the cards appear automatically when demo accounts exist.

## How to use it
```
[Login page] → scroll below "Sign in"
                    ↓
        "Or quick login as"
                    ↓
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ LOGIN AS │ │ LOGIN AS │ │ LOGIN AS │
   │  Ahmed   │ │ Manager  │ │   HR     │
   └─────────┘ └─────────┘ └─────────┘
      (blue)      (green)     (purple)
                    ↓  click a card
        [Dashboard opens, signed in]
```

1. Open the CDS Business login page.
2. Below the **Sign in** button, find the "Or quick login as" divider.
3. Click a card — **Ahmed** (employee), **Manager**, or **HR**.
4. The card shows a spinner while signing you in, then the dashboard opens
   exactly as if you had typed the email and password.

## Notes & common mistakes
- **Cards missing?** The feature is off in this environment (e.g. production)
  or demo data isn't seeded — use the normal sign-in form instead.
- **Card click does nothing / error shown?** The demo account may be inactive;
  sign in normally or ask an admin.
- All three cards work in English and Arabic, and in light/dark mode.

## FAQ
- **Is this a different kind of login?** No — it's a real session identical
  to signing in with that account's email and password.
- **Can I still use the normal form?** Yes — email/password sign-in is
  unchanged.
- **Does it work on my phone?** Yes — the cards wrap to fit small screens.
