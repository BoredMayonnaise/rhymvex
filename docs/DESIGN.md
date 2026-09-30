# Rhymvex — Design System

> "Build with rhythm."

## Overview

This document defines the visual and design language for **Rhymvex** — a brand and product agency that builds clear, high-performing brand systems across design, content, and growth. Everything here is the single source of truth for designers, developers, VAs, and partners.

---

## Brand Identity

| Property | Value |
|---|---|
| **Full Name** | Rhymvex |
| **Type** | Brand & Product Agency |
| **Tagline** | "Build with rhythm." |
| **Campaign Lines** | "Patterns, solved." · "Design. Systems. Impact." |
| **Core Promise** | "We turn complex ideas into clean, repeatable systems that look great and perform." |

### Brand Personality

- **Sharp & Modern** — contemporary, tech-literate, design-forward
- **Confident, not arrogant** — clear authority without hype
- **Structured & Creative** — design with systems and logic behind it
- **Slightly edgy** — not corporate, not generic

---

## Logo System

### Variants

| Variant | Usage |
|---|---|
| **Horizontal Wordmark** | Website headers, proposal covers, deck slides, YouTube/LinkedIn banners, main marketing assets |
| **Rv Monogram / Icon** | Profile pictures, favicons, app icons, placements where the full wordmark doesn't fit |
| **Full Logo (Light)** | Light backgrounds |
| **Full Logo (Dark)** | Dark backgrounds |
| **Wordmark only** | Minimal contexts where icon is not needed |

### Clear Space & Minimum Size

- **Clear space**: at least the height of the letter "R" on all sides
- **Digital minimum**: 24 px logo height in UI and ads
- **Profile pictures**: export at ≥ 400 × 400 px
- **Print minimum**: 8 mm logo height

### Logo Rules

| ✅ DO | ❌ DON'T |
|---|---|
| Use on solid or simple backgrounds (Black, Slate, or dark images with overlay) | Stretch, skew, or rotate the logo |
| Use full-color version on dark backgrounds | Add effects (drop shadows, gradients, outlines) outside the defined system |
| Use white/black mono version on busy images with sufficient contrast | Place on low-contrast or noisy backgrounds without a safe zone |
| | Change colors outside the defined palette |

---

## Color Palette

> Maximum **three main colors** per creative: Black/Slate + White + Volt (± Ember).

| Name | Hex | Role |
|---|---|---|
| **Rhymvex Black** | `#0B0F14` | Primary background — posts, reels covers, story templates, ad backgrounds |
| **Rhymvex Slate** | `#151B24` | Secondary backgrounds — cards, overlay panels, UI surfaces |
| **Rhymvex White** | `#F5F7FA` | Primary text on dark backgrounds; main headings and key UI text |
| **Rhymvex Volt** | `#6EE7FF` | Primary accent — CTAs, buttons, key words, highlights, metrics |
| **Rhymvex Ember** | `#FF6B6B` | Secondary accent — urgency tags ("New", "Limited"), alerts |

### CSS Design Tokens

```css
:root {
  --rhymvex-black:  #0B0F14;
  --rhymvex-slate:  #151B24;
  --rhymvex-white:  #F5F7FA;
  --rhymvex-volt:   #6EE7FF;
  --rhymvex-ember:  #FF6B6B;

  --font-primary: Inter, system-ui, -apple-system, sans-serif;
  --font-display: 'Space Grotesk', 'Sora', sans-serif;
}
```

Keep tokens in a single source of truth (CSS/SCSS or Figma variables) so every template and web surface stays in sync.

---

## Typography

| Role | Font | Weights |
|---|---|---|
| **Body / UI** | Inter | 400, 500, 600, 700 |
| **Display / Headlines** | Space Grotesk or Sora | Headlines only |

### Rules

- One font family per creative
- Text must be legible on mobile at all times
- Keep text short inside creatives — details belong in captions
- Never crowd text; keep margins generous

---

## Content Templates

### The Four Must-Have Templates (Figma / Canva)

#### Case Study Card
- `"Case Study"` label in **Volt**
- Large visual (mockup / before-after)
- 2–3 bullet results + CTA "See full case study"

#### Quote / Insight Card
- Black/Slate background with subtle grid or wave
- Large White quote
- `"— Rhymvex"` attribution in muted white

#### Offer / Promo Card
- Bold headline (e.g. "3 Brand Slots — January")
- 1–2 line description
- Volt CTA button ("Book now")
- Ember badge for urgency

#### Process / Framework Card
- Title + numbered steps with icons
- Volt numbers/connectors
- Minimal text per step

### Video / Reels / TikTok

| Property | Spec |
|---|---|
| **Format** | 9:16 vertical, 1080 × 1920 |
| **Background** | Black/Slate with subtle motion (zoom, pan, animated grid) |
| **Hook** | Large White text with Volt highlight in first 1–2 s; 1–2 lines max |
| **Watermark** | Monogram icon bottom-right at low opacity |
| **Intro** | 1–2 s: logo + tagline "Build with rhythm." |
| **Outro** | CTA + logo |

---

## Ad Creative Guidelines

### Meta (IG/FB) Feed Ads

- **Format**: 1080 × 1080 or 1080 × 1350
- **Structure**: hook headline (White, bold) → visual (mockup, result graphic, before/after) → short subtext + Volt CTA button
- Keep on-image text minimal; the caption carries details

**Example**: Image: "Your brand needs a system." · Caption: "We design brand systems that turn attention into revenue." · CTA: "See our work"

### Story / Reels Ads

- Full-screen vertical; first frame is the hook — big text, 3–6 words
- Quick cuts, simple motion, minimal on-screen text
- End frame: clear CTA + logo

### LinkedIn Ads

- Professional tone, still visual
- Case-study style: "How we 3× inbound leads in 90 days"
- Simple chart/graph in Volt on Slate
- CTA: "Book a call" or "Download case study"

### Google Display / YouTube

- Consistent branding: Black/Slate background, White text, Volt accents
- Pre-roll: strong hook + visual in first 3 s → quick proof (metrics, logos, before/after) → CTA + logo

> **Build 3–5 ad variations** — two feed ads (work-focused, offer-focused), one story/reels ad, one LinkedIn case-study ad — and A/B test headlines and CTAs.

---

## Do's & Don'ts

| ✅ DO | ❌ DON'T |
|---|---|
| Use a consistent template system so the feed looks cohesive | Change styles every week — consistency builds recognition |
| Highlight one key idea per creative | Overload posts with text or too many visuals |
| Keep text short and legible on mobile | Use random colors or gradients outside the palette |
| Use Volt strategically to guide the eye (CTA, key numbers, key words) | Move the logo to a different position on every post — pick 1–2 standard spots |
| Keep the same profile pic, color feel, and tone across all channels | Write long paragraphs inside images — that belongs in captions |

---

## Asset Organization

```
/rhymvex-brand
  /logo         — wordmark + icon, primary/white, .svg + .png
  /colors       — palette swatches + colors.css / colors.scss
  /type         — font files + type-scale reference
  /templates    — social cards, ad formats (.fig / .canva)
  /guidelines   — this doc + condensed one-pager
```

---

## Implementation Checklist

- [ ] **Assets** — Finalize logo (wordmark + icon) in SVG/PNG; export profile pics and banners per platform; build 4–6 core post templates in Figma/Canva
- [ ] **Profiles** — Update profile pics, banners, bios on IG, TikTok, X, LinkedIn, YouTube, FB; set consistent handle (`@rhymvex`)
- [ ] **Content** — Plan 2 weeks of posts across the 4 pillars; create ≥ 4 case-study cards, 4 quote/insight cards, 2 offer/promo cards, 2 process/framework cards
- [ ] **Ads** — Build 3–5 ad variations (2 feed, 1 story/reels, 1 LinkedIn); A/B test headlines and CTAs
- [ ] **Documentation** — Save this guide as PDF + Notion/Google Doc; share with everyone creating content or ads for Rhymvex
