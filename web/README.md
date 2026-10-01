# Rhymvex platform

The public site, the Rhymvex workspace, and the client portal are one system.

The public site takes a request. The workspace picks it up. The client portal
shows the client where their own work stands. Every step is recorded.

---

## The idea

A visitor should not have to know which service they need before they can talk
to Rhymvex. So the site asks what is going on, not what they want to buy:

> Tell us what you're trying to solve.

That submission becomes a **Lead**, not a client. A lead becomes a **Client**
only when someone decides to work together. Nothing is automatic, and no form
submission is treated as a sale.

---

## Getting started

```bash
docker compose up -d --wait        # local Postgres on 127.0.0.1:5435
cd web
cp .env.example .env.local         # then fill in SESSION_SECRET
npm install
npm run db:migrate
npm run db:seed                    # optional demo data
npm run dev
```

Seeded credentials (development only):

| Workspace | Sign in at | Credentials |
|---|---|---|
| Staff | `/login` | `sam@rhymvex.com` / `RhymvexAdmin2026` |
| Client | `/portal-sign-in` | `rina@harbourlight.test` / `RhymvexAdmin2026` |

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `db:down` | Start or stop the local database |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:reset` | Drop the volume, migrate, seed |
| `npm run verify` | Run all three verification suites |

---

## How a request travels

```
Visitor
  │
  ├─ /intake  (rate limit → honeypot + fill time → schema validation)
  │
  ├─ lead created ── and ── lead.received written to audit_log
  │                    (one transaction, so a lead always has its origin)
  │
  ├─ client confirmation email      "We received your request — Rhymvex"
  ├─ internal notification email    "New Rhymvex lead — {company}"
  │                                 includes the workspace link
  │
  └─ in-site success state
       ✓ Request received
       ✓ Information recorded
       ✓ Rhymvex team notified
       ○ Human consultation
```

Email is sent **after** the lead commits. A mail server being down must not lose
a request from someone who trusted us with their situation, so a failed send is
recorded and surfaced rather than rolling the lead back.

### Where someone can start a conversation

Four placements, one form, one endpoint:

| Placement | Opens by |
|---|---|
| Hero | Inline capture, above the fold, no click |
| Modal | The nav icon, the services CTAs, every service card |
| Bottom | The closing panel, beside the headline |
| `/intake` | The full form, linked from the hero |

A service card's CTA opens the modal with its situation already selected, so
clicking "Let's find the problem" does not make the visitor choose their
problem again. They have still not chosen a package.

`mailto:` is not a contact path. The only one left is the visible address in the
footer.

All four share `components/lead/lead-capture-shared.ts`, so the honeypot, the
fill-time signal and the result shape cannot drift between them. The compact
form asks for four things — name, email, situation, what is going on — and leaves
company, budget, timeline and website to the full form. Those belong after
someone has decided to talk to us.

### Response times

`org_settings.response_sla_minutes` decides whether a timeframe is promised.
Empty means the confirmation deliberately says nothing about when, which is the
honest default. The intake page says so explicitly rather than staying silent.

---

## Workspaces

### Staff workspace — `/admin`

```
WORKSPACE          MANAGE
  Overview           Reports
  Leads              Staff & Access
  Clients            Security
  Bookings           Settings
  Proposals
  Contracts
  Projects
  Team Tasks
  Accounting
  Library
  Business Email
```

Nav items are filtered by the permission set the server already resolved, so a
link never appears for someone the page would refuse. That is convenience, not
control: every page and every action re-checks server-side.

The lead detail view carries the request unedited, internal notes walled off
visually, and the full audit history. Actions: assign, change status, add note,
create client, schedule consultation, create proposal, send email.

### Client portal — `/portal`

```
WORKSPACE          ACCOUNT
  Overview            Profile
  Messages            Settings
  Projects
  Proposals
  Contracts
  Bookings
  Files
  Invoices
```

Deliberately plainer than the admin workspace. A client is not managing the
business, so there is no pipeline, no staff load, and no configuration. The
overview answers one question: what is happening with my work?

---

## Leads are not clients

A form submission is a Lead. Conversion is a human decision, made from the lead
detail view. Converting:

- creates the `clients` row and links it both ways
- makes the submitting person the primary contact
- marks the lead `WON`
- seeds the engagement, if a model was chosen
- writes `client.created` and `lead.client_created` to the audit trail

`clients.lead_id` is unique, so a lead can only ever be converted once.

Engagement models — Brand Sprint, Brand System, Rhythm Retainer, Custom — are
shapes of work, not purchasable products. The recommendation happens after the
situation is understood, and it lives on the lead as
`recommended_model`.

---

## Security

| Control | How it works |
|---|---|
| Passwords | scrypt, per-user salt, params stored inline with the digest |
| Sessions | Separate tables and cookies for staff and clients; neither is accepted by the other's routes |
| Cookies | httpOnly, SameSite=Lax, Secure in production, HMAC-signed id |
| CSRF | Session-bound token, verified on every mutation |
| Authorisation | Resolved server-side per action from the session |
| Tenant isolation | Portal reads scope by the session's `client_id` in SQL, never by a URL id |
| Audit | Append-only, enforced by a database trigger; UPDATE and DELETE raise |
| Invitations | 32 CSPRNG bytes, SHA-256 digest only, single-use, expiring, revocable |
| Intake | Rate limit per IP, honeypot field, minimum fill time |
| Secrets | Environment only; never stored, logged or displayed |

`DATABASE_URL` points at a local Docker Postgres. Production points at managed
Postgres; the queries are portable and all access goes through
`lib/db/client.ts`.

### Tenant isolation

Every function in `lib/data/portal.ts` takes the session and reads the client id
from it. None accepts a client id from a route parameter. Swapping an id in the
address bar returns 404, which is indistinguishable from the record not
existing, so the portal cannot be used to probe for valid ids.

Staff reads live separately in `lib/data/clients.ts` and are not reachable from
a client session.

### Invitation tokens

Only the SHA-256 digest is stored, so a database compromise yields no usable
token. A token authorises exactly one transition — creating an account with a
password the recipient chooses. It is never a session and never a standing
credential. The status change and the account insert share a transaction, so two
concurrent redemptions produce exactly one account.

Statuses: `PENDING` → `ACCEPTED`, or → `EXPIRED` / `REVOKED`.

### What is kept away from clients

| Staff-only | Why |
|---|---|
| `lead_notes` | No client_id, no portal read path |
| `audit_log` | The portal reads `client_activity`, a separate sanitised table |
| Internal email alerts | `client_visible = false`, filtered out of every portal query |
| Files not shared | `client_visible = false` |
| Invitations | Link is a credential; never exposed to an existing portal user |

---

## Design language

Unchanged. The workspaces use the existing tokens and rules from
`brand/tokens/tokens.json`:

| Token | Value | Role |
|---|---|---|
| Rhymvex Black | `#0B0F14` | Foundation |
| Rhymvex Slate | `#151B24` | Panels, cards |
| Rhymvex White | `#F5F7FA` | Text |
| Rhymvex Volt | `#6EE7FF` | Interactive, status, accents |
| Rhymvex Ember | `#FF6B6B` | Errors and internal-only markers |

No new colour was introduced. The workspace layer in `app/globals.css` adds
density — tighter hairlines, smaller tracked labels, flat data surfaces — rather
than a new palette. Volt stays reserved for interactive elements and status;
Ember appears only for errors and for the "internal, never client visible"
marker.

The only structural change: a client portal and admin workspace now exist, both
using the same primitives (`.rv-btn`, `.rv-card`, `.rv-eyebrow`, `.rv-container`)
plus a workspace layer (`.rv-app`, `.rv-panel`, `.rv-table`, `.rv-status`).

---

## Layout

```
web/
  app/
    page.tsx                  public site
    intake/                   client-first intake form
    api/intake/               the submission endpoint
    login/  portal-sign-in/   both sign-in pages
    invite/                   branded invitation acceptance
    admin/                    staff workspace (16 routes)
    portal/                   client portal (11 routes)
    actions.ts                sign out
  components/
    intake/                   form and success state
    admin/  portal/  ui/      workspace components
  lib/
    auth/                     password, sessions, rbac, guards, invitations
    data/                     leads, clients, workspace, portal, email, org
    db/                       client, migrations, seed, reference, ids
    mail/                     smtp, templates, invitation, outbound
    admin-nav.ts  validation.ts  audit.ts  format.ts  rbac helpers
  proxy.ts                    coarse route gate
  scripts/
    verify.sh                 auth, tenancy, audit, mailto checks
    verify-invitations.ts     token lifecycle checks
    verify-workflow.sh        intake end to end
```

---

## Email

`SMTP_HOST` empty means messages are rendered in full and written to
`email_outbox` with `delivery = 'dev'`, plus a console summary. The whole
workflow is therefore reviewable before real credentials exist, and setting the
env vars switches to real delivery with no code change.

Two separate tables:

- `email_outbox` — every message produced, whether delivered or not
- `email_messages` — the business record, tied to a lead, client, project or
  proposal, which is what makes Business Email an inbox rather than a mailto

The client confirmation never contains an internal URL. The internal
notification's workspace link only ever goes to
`INTERNAL_NOTIFICATION_EMAIL`.

---

## Verification

```bash
npm run dev &
npm run verify
```

104 checks across three suites, each repeatable:

- **`verify.sh`** (41) — authentication required, session types do not cross
  over, tenant isolation, internal data absent from the portal, no mailto
  workflow, audit immutability, token hygiene, no auto-conversion, spam handling
- **`verify-invitations.ts`** (33) — token randomness, digest-only storage,
  single use, expiry, revocation, re-invite, client portal binding, auditing
- **`verify-workflow.sh`** (30) — intake creates a lead, audit event, both
  emails with correct subjects, no admin URL in the client copy, no SLA promise
  when none is set, spam controls, rate limiting

---

## Deployment notes

Set in the production environment:

- `DATABASE_URL` — managed Postgres
- `SESSION_SECRET` — 32+ random bytes, base64url. Required.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`
- `SMTP_FROM`, `INTERNAL_NOTIFICATION_EMAIL`
- `NEXT_PUBLIC_SITE_URL` — used for metadata and for links in email
- `NEXT_PUBLIC_CALENDAR_URL` — optional; without it "Book a call" goes to intake
- `RESPONSE_SLA_MINUTES` — optional; only set this if the team will keep it

`npm run db:migrate` is safe to run on every deploy. Migrations are checksummed
and refuse to run if an already-applied file has been edited.

The platform is a relationship system, not a contact form attached to a panel.
Leads, clients, engagements, delivery, and the audit trail are the same records
the team works from.
