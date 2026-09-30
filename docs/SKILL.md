---
name: rhymvex-brand
description: >
  Rhymvex brand and creative skill. Provides brand context, design token references,
  voice guidelines, content pillar rules, and output standards for all Rhymvex creative
  and development work. Activate this skill for any task involving copy, design,
  code, or content for the Rhymvex brand.
---

# Rhymvex Brand Skill

## What This Skill Does

This skill equips any AI agent with the full Rhymvex brand system so every output — from a social caption to a landing page — is consistent, on-brand, and high-performing.

Activate this skill when working on:
- Social media content (captions, hooks, CTAs)
- Ad copy (Meta, LinkedIn, YouTube, Google Display)
- UI/front-end code (colors, fonts, components)
- Brand strategy or positioning documents
- Case study narratives or thought leadership posts
- Design system implementation or token management

---

## Quick Reference

### Identity
| | |
|---|---|
| **Name** | Rhymvex |
| **Type** | Brand & Product Agency |
| **Tagline** | "Build with rhythm." |
| **Core promise** | "We turn complex ideas into clean, repeatable systems that look great and perform." |
| **Audience** | Founders and teams who need end-to-end brand systems |

---

### Colors

```
Rhymvex Black  #0B0F14  → Primary background
Rhymvex Slate  #151B24  → Secondary backgrounds, cards, panels
Rhymvex White  #F5F7FA  → Primary text on dark backgrounds
Rhymvex Volt   #6EE7FF  → CTAs, highlights, key words, metrics  ← use strategically
Rhymvex Ember  #FF6B6B  → Urgency only ("New", "Limited", alerts)
```

**Rule:** Max 3 colors per creative — Black/Slate + White + Volt (± Ember).

### CSS Tokens

```css
:root {
  --rhymvex-black:  #0B0F14;
  --rhymvex-slate:  #151B24;
  --rhymvex-white:  #F5F7FA;
  --rhymvex-volt:   #6EE7FF;
  --rhymvex-ember:  #FF6B6B;
  --font-primary:   Inter, system-ui, -apple-system, sans-serif;
  --font-display:   'Space Grotesk', 'Sora', sans-serif;
}
```

---

### Typography

| Role | Font |
|---|---|
| Body / UI | Inter (400 / 500 / 600 / 700) |
| Display / Headlines | Space Grotesk or Sora |

One font family per creative. Text must be legible on mobile. Details in captions — not inside images.

---

## Voice & Tone Instructions

**Voice:** Clear, confident, structured, slightly playful. Never corporate. Never generic.

**Style:**
- Short, punchy sentences
- One idea per post or piece
- Direct and authoritative
- Slightly edgy — not safe, not bland

**Examples:**
```
✅  "Your brand is a system. Build it like one."
✅  "Most agencies give you a logo. We give you a playbook."
✅  "If your message is fuzzy, your results will be too."
❌  "We are pleased to offer our comprehensive suite of design services."
❌  "Our team of experts leverages best-in-class methodologies..."
```

**Approved CTAs** (use these verbatim):
- See our work
- Book a call
- Get your brand audit
- Start your project
- View case study
- Download the framework

---

## Content Pillars

Every piece of content must belong to exactly **one** pillar:

| # | Pillar | What to produce |
|---|---|---|
| 1 | **Work / Case Studies** | Before/after visuals, metrics, short breakdowns using Challenge → Solution → Result |
| 2 | **Process & Systems** | Frameworks, checklists, diagrams, behind-the-scenes, numbered steps |
| 3 | **Thought Leadership** | Opinions on branding/design/marketing, "most brands get X wrong", trend takes |
| 4 | **Offers & Lead Magnets** | Free audits, templates, mini-guides, limited campaign slots, workshop promos |

---

## Template Patterns

### Case Study Card
```
Label:   "Case Study" in Volt
Visual:  Large mockup or before/after image
Body:    2–3 bullet results
CTA:     "See full case study"
```

### Quote / Insight Card
```
Background:  Black/Slate + subtle grid or wave
Quote:       Large White text
Attribution: "— Rhymvex" in muted white
```

### Offer / Promo Card
```
Headline:    Bold (e.g. "3 Brand Slots — January")
Description: 1–2 lines
CTA:         Volt button ("Book now")
Badge:       Ember for urgency
```

### Process / Framework Card
```
Title:   Clear header
Steps:   Numbered with icons; Volt connectors/numbers
Text:    Minimal per step — one idea each
```

---

## Ad Creative Rules

| Format | Spec |
|---|---|
| Meta Feed | 1080×1080 or 1080×1350 |
| Stories / Reels | 9:16, 1080×1920 |
| LinkedIn | Professional, case-study style |
| YouTube Pre-roll | Hook in first 3 s, CTA + logo end card |

**Structure for all ads:** Hook → Visual proof → CTA

Build 3–5 ad variations. A/B test headlines and CTAs. Never run a single untested version.

---

## Code Guidelines

When writing front-end code for Rhymvex:

1. **Always** import and use CSS custom properties from the token spec above
2. Default to dark backgrounds (`--rhymvex-black` / `--rhymvex-slate`)
3. Use `--rhymvex-volt` for buttons, links, active states, and highlights
4. Use `--rhymvex-ember` for error states and urgency indicators **only**
5. Primary font is Inter via `--font-primary`; display headings use `--font-display`
6. Components must be modular, documented, and reusable — matching the "systems thinking" ethos

---

## Output Quality Checklist

Run this before finalizing any output:

- [ ] Colors are from the defined palette only
- [ ] No more than 3 colors in any single creative
- [ ] Volt used for accent/highlight — not decoratively overused
- [ ] Ember used for urgency only
- [ ] Font is Inter (body) or Space Grotesk/Sora (display)
- [ ] Voice is clear, confident, structured — no corporate language
- [ ] Content maps to exactly one content pillar
- [ ] CTA uses an approved phrase (verbatim)
- [ ] Logo placement is consistent (1–2 fixed spots)
- [ ] On-image text is minimal; details belong in captions

---

## Related Documents

- [`DESIGN.md`](./DESIGN.md) — Full visual identity, logo system, templates, ad guidelines, asset organization
- [`AGENTS.md`](./AGENTS.md) — AI agent roles, rules, channel matrix, and behavior standards
- `Rhymvex_Brand_Kit_and_Guidelines.pdf` — Official brand kit (master reference)
