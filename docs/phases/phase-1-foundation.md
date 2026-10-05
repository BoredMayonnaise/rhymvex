# Phase 1 — Foundation

> **Goal:** Everything Rhymvex needs to exist professionally — brand locked, infrastructure live, and ready to take on first clients.

**Status:** 🔄 In Progress
**Estimated Duration:** 3–4 weeks
**Preceded by:** —
**Followed by:** [Phase 2 — Launch](./phase-2-launch.md)

---

## Overview

Phase 1 is about building the machine before turning it on. No client work starts here — this phase is purely about getting the foundation airtight: brand identity finalized, platforms set up, systems documented, and tools ready. When Phase 1 is done, Rhymvex can present itself confidently to any client or partner.

---

## Goals

- [ ] Brand identity is 100% finalized and documented
- [ ] All social profiles are live and on-brand
- [ ] Website is live (at minimum a landing page)
- [ ] Core service offering is defined and priced
- [ ] Internal systems and tools are set up
- [ ] Agency is ready to take on its first client

---

## Workstreams

### 🎨 Brand & Design

| Task | Status | Notes |
|---|---|---|
| Finalize logo (wordmark + Rv icon) in SVG/PNG | ✅ | Brand kit complete |
| Lock color palette and CSS tokens | ✅ | See `DESIGN.md` |
| Define typography system (Inter + Space Grotesk/Sora) | ✅ | |
| Export profile pics (≥ 400×400 px) for all platforms | ✅ | 800×800 Rv monogram, white + volt variants |
| Design LinkedIn, YouTube, X banners | ✅ | `brand/banners/` — generated from tokens |
| Build 4–6 core post templates in Figma/Canva | ✅ | 4 done: Case Study, Quote, Offer, Process (`brand/templates/`) |
| Create brand kit one-pager for clients/partners | ✅ | PDF exists |

---

### 🌐 Web & Tech Infrastructure

| Task | Status | Notes |
|---|---|---|
| Register domain (`rhymvex.com`) | ⏳ | External — needs registrar account |
| Set up hosting / deployment pipeline | ⏳ | App builds clean (`npm run build` ✅); deploy target TBD |
| Build landing page (hero + positioning + CTA) | ✅ | `web/` — Next.js, dark theme, Volt CTA, services sync-checked |
| Set up professional email (`support@rhymvex.space`) | ⏳ | |
| Set up analytics (Google Analytics / Plausible) | ⏳ | |
| Set up project management tool (Notion / Linear) | ⏳ | |
| Set up CRM or contact tracking (basic) | ⏳ | |

---

### 📱 Social & Channels

| Task | Status | Notes |
|---|---|---|
| Claim `@rhymvex` handle on IG, TikTok, X, LinkedIn, YouTube, FB | ⏳ | External — needs platform accounts |
| Update profile pictures on all platforms | ⏳ | Assets ready: `brand/profiles/rv-monogram-black.png` |
| Upload banners on LinkedIn, YouTube, X | ⏳ | Assets ready: `brand/banners/banner-{linkedin,youtube,x}.png` |
| Write and publish bios on all platforms | ⏳ | See `AGENTS.md` for approved copy |
| Pin a first post / intro reel | ⏳ | Templates ready in `brand/templates/` |

---

### 💼 Business & Offerings

| Task | Status | Notes |
|---|---|---|
| Define core service packages (3–4 tiers) | ✅ | 3 packages: Brand Sprint, Brand System, Rhythm Retainer (`content/services.json`) |
| Set pricing for each package | ⏳ | Draft pricing written — pending approval before publishing |
| Write one-page services overview | ✅ | `docs/business/services-and-pricing.md` |
| Define onboarding process for new clients | ✅ | `docs/business/client-intake.md` — 5-stage process |
| Set up invoicing / payment (Stripe, Wave, etc.) | ⏳ | External — needs Stripe account |
| Prepare proposal/deck template | ✅ | `docs/business/proposal-template.md` |

---

### 📄 Documentation

| Task | Status | Notes |
|---|---|---|
| Complete `DESIGN.md` | ✅ | |
| Complete `AGENTS.md` | ✅ | |
| Complete `SKILL.md` | ✅ | |
| Write agency phases plan (this doc) | ✅ | All 4 phase files + index complete |
| Document client intake process | ✅ | `docs/business/client-intake.md` |

---

## Deliverables

By the end of Phase 1, the following must exist:

1. **Brand assets** — logo SVG/PNG, color swatches, CSS tokens, font stack
2. **Social profiles** — all platforms live with correct handle, bio, profile pic, and banner
3. **Landing page** — live at `rhymvex.com` with hero, positioning statement, and CTA
4. **Service packages** — 3–4 defined, priced, and documented
5. **Proposal template** — ready to send to a prospect
6. **Post templates** — 4 Figma/Canva templates ready
7. **Internal tooling** — project management, email, analytics, CRM in place

---

## KPIs (Phase Complete When…)

- [ ] All social profiles live and on-brand — *blocked: platform accounts needed; assets ready*
- [ ] `rhymvex.com` is live and passes a basic brand review — *blocked: domain + hosting; app builds clean*
- [ ] Services are defined, priced, and presentable — *defined ✅, priced ⏳ (draft pending approval)*
- [x] At least 4 post templates are production-ready
- [ ] Agency is ready to send its first proposal — *template ✅; unblocks when pricing is approved*

---

## Notes & Decisions

> Use this section to log key decisions made during Phase 1.

- **2026-09-29** — Brand kit v1.0 finalized. Logo, colors, typography, and guidelines documented.
- **2026-09-30** — Asset generator (`scripts/build_assets.py`) completed: profile pics, 3 banners, 4 post templates. Web app builds clean; content sync check passes. Business docs drafted: services & pricing, proposal template, client intake process. Remaining Phase 1 work is external: domain, hosting, email, analytics, Stripe, social accounts, pricing approval.
