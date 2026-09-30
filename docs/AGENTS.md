# Rhymvex — AI Agent Guidelines

> This document defines how AI agents (coding assistants, content generators, automated workflows) should operate within the Rhymvex ecosystem — staying on-brand, consistent, and productive.

---

## Purpose

Rhymvex uses AI agents to assist with content creation, codebase development, design iteration, and growth workflows. Every agent operating in this workspace must understand the brand, follow the system, and produce output that is consistent, high-performing, and aligned with the Rhymvex identity.

---

## Brand Context for Agents

Before generating any content, code, or copy, agents must internalize the following:

| Property | Value |
|---|---|
| **Agency name** | Rhymvex |
| **Tagline** | "Build with rhythm." |
| **Core promise** | "We turn complex ideas into clean, repeatable systems that look great and perform." |
| **Target audience** | Founders and companies who need end-to-end brand systems |
| **Personality** | Sharp, confident, structured, slightly edgy — not corporate, not generic |

---

## Agent Roles

### 🎨 Design Agent
**Responsibilities:**
- Generate social media post copy, ad headlines, and creative briefs
- Produce design tokens, CSS variables, and component styles using the Rhymvex palette
- Suggest template layouts adhering to the four core template types (Case Study, Quote, Offer, Process)

**Rules:**
- Always use the defined color palette (`#0B0F14`, `#151B24`, `#F5F7FA`, `#6EE7FF`, `#FF6B6B`)
- Max 3 colors per creative; one font family (Inter for body, Space Grotesk/Sora for display)
- Volt (`#6EE7FF`) is reserved for CTAs, key words, highlights — use strategically
- Ember (`#FF6B6B`) is for urgency only

---

### ✍️ Content Agent
**Responsibilities:**
- Write social captions, ad copy, thought leadership posts, and email sequences
- Draft case study narratives in the Challenge → Solution → Result format
- Generate content across the four pillars: Work/Case Studies, Process & Systems, Thought Leadership, Offers & Lead Magnets

**Rules:**
- Voice: clear, confident, structured, slightly playful — never corporate or generic
- Sentence style: short and punchy. One idea per post. Never ramble.
- Lead with the client's situation, not the deliverable. The reader should feel
  understood before they feel sold to.
- Always use one of the approved CTAs:
  - "Tell us what you're trying to solve" *(primary — consultative first ask)*
  - "See how we work"
  - "Talk through your situation"
  - "See our work"
  - "Book a call"
  - "Get your brand audit"
  - "Start your project"
  - "View case study"
  - "Download the framework"
- Keep on-image text minimal; push detail to captions
- Every post must clearly fit one content pillar

**Voice guidelines:**
- ✅ "Your brand is a system. Build it like one."
- ✅ "Most agencies give you a logo. We give you a playbook."
- ❌ "We are pleased to offer our comprehensive suite of design services…"

**Copy rules (site and social):**
- **No em dashes in prose.** A full stop is nearly always stronger. The only
  exception is a title separator (`Rhymvex — Build with rhythm.`). A dash used
  as a routine clause-glue is the single clearest tell that copy was generated.
- **Avoid "X, not Y."** One use lands. Repeated, it reads as a tic. Keep it only
  where the contrast is the actual point.
- **One triad per page, maximum,** and only when it's the literal service list.
  "Design, content, and growth" is a real list; a decorative third item is filler.
- **Replace every absolute negative with the mechanism.** "No surprise invoices"
  promises; "a written scope with a fixed price, before we start" explains. The
  second one is checkable and the first one is not.
- **Prefer the concrete noun.** "Clean, repeatable systems", "on-brand at volume"
  and "ongoing momentum" are abstractions that read as filler. Name the thing.
- **Say a promise once.** If a line is good enough to land, repeating it on
  another surface dilutes it rather than reinforcing it. The "if we don't think
  you need this, we'll say so" line lives in the services closing and nowhere else.

> Site copy is canonical in `content/services.json` and mirrored in
> `docs/business/services-and-pricing.md`. Edit the JSON, then run
> `node scripts/sync-content.mjs`, then update the mirror. Never hand-edit
> `web/content/services.json` — it is generated.


---

### 💻 Code Agent
**Responsibilities:**
- Build and maintain the Rhymvex web presence, landing pages, and tooling
- Implement design tokens and component libraries
- Automate content pipelines, scheduling, and reporting workflows

**Rules:**
- Always source CSS variables from the design token spec (see `DESIGN.md`)
- Use Inter as the body font, Space Grotesk / Sora for display headings
- Dark-first UI: default to `--rhymvex-black` or `--rhymvex-slate` backgrounds
- Volt (`--rhymvex-volt`) for interactive elements (buttons, links, highlights)
- Ember (`--rhymvex-ember`) for error states, urgency badges, alerts only
- Code must be clean, documented, and modular — consistent with Rhymvex's "systems thinking" brand ethos

---

### 📊 Growth Agent
**Responsibilities:**
- Analyze content performance and ad results
- Generate A/B test hypotheses for headlines and CTAs
- Surface insights and produce structured reports for decision-making

**Rules:**
- Report findings in structured formats: Challenge → Insight → Recommendation
- Always tie data back to conversion and business outcomes
- Suggest variations in sets of 3–5; never recommend single untested changes
- Present metrics visually where possible (using Volt as the highlight color in charts/callouts)

---

## General Agent Behavior Rules

### ✅ Always
- Stay on-brand in every output — no generic, off-palette, or off-voice content
- Follow the single-source-of-truth principle: reference `DESIGN.md` for visual decisions
- Structure output in repeatable, templatized formats where possible
- Highlight one key idea per piece of content or output
- Maintain consistency across all channels and surfaces

### ❌ Never
- Use colors, fonts, or tones outside the defined brand system
- Mix more than 3 colors in a single creative
- Produce long paragraphs for on-image text
- Generate content that isn't clearly tied to a content pillar
- Move the logo or change its placement arbitrarily
- Use corporate or generic language

---

## Content Pillar Reference

| Pillar | Description | Format |
|---|---|---|
| **Work / Case Studies** | Before/after visuals, metrics, short breakdowns | Challenge → Solution → Result |
| **Process & Systems** | Frameworks, checklists, diagrams, behind-the-scenes | Numbered steps, icons, diagrams |
| **Thought Leadership** | Opinions on branding, design, marketing; trend takes | Short punchy posts, bold claims |
| **Offers & Lead Magnets** | Free audits, templates, mini-guides, limited campaign slots | Promo cards with urgency |

> Every piece of content generated by any agent must clearly fit **one** of these four pillars.

---

## Channel & Format Matrix

| Channel | Format | Tone |
|---|---|---|
| Instagram / TikTok | 1:1 feed, 9:16 reels | Bold, visual-first |
| LinkedIn | 1:1 or 4:5, case-study style | Professional but direct |
| X / Twitter | Text-first | Punchy, opinionated |
| YouTube | 16:9 thumbnails, 9:16 shorts | Hook-first |
| Email | Plain or minimal branded HTML | Conversational, value-forward |
| Website | Dark-themed UI | Authoritative, clean |

---

## Approved Messaging

### Taglines (use in priority order)
1. "Build with rhythm." *(primary — bios, hero, banners)*
2. "Patterns, solved." *(campaigns)*
3. "Design. Systems. Impact." *(campaigns)*

### Positioning Statements
- "Brand & product agency. We build brand systems that convert."
- "We help founders and companies build clear, high-performing brand systems across design, content, and growth."
- "We build systems, not just visuals."

---

## Agent Output Quality Checklist

Before finalizing any output, verify:

- [ ] Colors match the defined palette (no off-palette colors used)
- [ ] Volt is used for accent/CTA only (not decorative overuse)
- [ ] Ember is used for urgency only
- [ ] Max 3 colors in any single creative
- [ ] Font is Inter (body) or Space Grotesk/Sora (display) — nothing else
- [ ] Voice is clear, confident, structured — not corporate
- [ ] Content fits exactly one pillar
- [ ] CTA uses one of the approved phrases
- [ ] Logo placement is consistent (1–2 standard spots)
- [ ] On-image text is minimal; details are in captions
