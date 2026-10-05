---
name: ui-ux-designer
description: Comprehensive UI and UX design guidelines, user experience heuristics, component architecture, visual hierarchy, responsive layouts, accessibility standards, and terminal UI design. Use when designing user interfaces, reviewing UX flows, creating frontend design systems, styling web or mobile components, improving usability, or formatting CLI application interfaces.
---

# ui-ux-designer

A comprehensive skill for designing, building, and evaluating user interfaces (UI) and user experiences (UX) across web, mobile, and CLI applications.

## When to Use

- Designing or refactoring frontend interfaces, web layouts, or mobile screens
- Establishing design systems, color palettes, typographic scales, or spacing tokens
- Improving usability, navigation flows, onboarding, or information architecture
- Implementing interaction states (loading, empty, error, active, disabled)
- Ensuring accessibility (WCAG compliance, keyboard navigation, contrast)
- Formatting CLI tool output, terminal prompts, progress bars, and error displays

## Core Design Principles

### 1. Visual Hierarchy and Layout

- Establish clear hierarchy: Guide the eye naturally from primary headers to secondary details and actions.
- Use an 8px grid system: Constrain all spacing (margins, padding, gap sizes) to multiples of 4px or 8px (e.g., 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px).
- Balance whitespace: Treat whitespace as an active structural element to group related content and prevent visual clutter.
- Group related items: Follow Gestalt proximity. Keep labels close to inputs, cards distinct from page background, and related controls tightly grouped.
- Responsive breakpoints: Build mobile-first. Ensure smooth layout adaptation across mobile (320px-480px), tablet (768px-1024px), desktop (1200px+), and ultrawide displays.

### 2. Typography and Readability

- Define a typographic ramp: Establish consistent font sizes, weights, and line heights.

  - Display: 32px-48px, Bold / Extrabold, line-height 1.1-1.2
  - Heading 1: 24px-30px, Semi-bold / Bold, line-height 1.25
  - Heading 2: 20px-24px, Semi-bold, line-height 1.3
  - Heading 3: 16px-18px, Medium / Semi-bold, line-height 1.4
  - Body Text: 14px-16px, Regular, line-height 1.5-1.6
  - Small / Caption: 12px-13px, Regular, line-height 1.4

- Limit font families: Use at most two typefaces (one clean sans-serif for UI, optionally one serif or mono for headings or code).
- Limit line length: Constrain body text to 45-75 characters per line for optimal scanning and reading comfort.

### 3. Color and Semantic Tokens

- Base and Surface: High-contrast neutrals for backgrounds, cards, sheets, borders, and dividers.
- Brand / Primary: One signature accent color for primary actions, active indicators, and focus outlines.
- Secondary / Neutral: Subtle muted tones for secondary actions, tags, or passive elements.
- Semantic States:

  - Success: Green tones for completed actions, confirmations, or positive trends.
  - Warning: Amber / Yellow tones for alerts, caution, and non-blocking issues.
  - Danger / Error: Red tones for destructive actions, validation errors, and critical failures.
  - Info: Blue / Cyan tones for neutral updates, hints, and informational badges.

- Dark mode compatibility: Map colors to semantic tokens (e.g., bg-surface, text-primary, border-muted) rather than hardcoded hex values.

### 4. Interaction States and Feedback

Every interactive element must provide immediate, unambiguous feedback for all user actions:

- Default: Clear affordance indicating clickability or interactivity.
- Hover / Pointer: Subtle elevation or brightness change on pointer hover.
- Focus: Highly visible focus ring (at least 2px offset) for keyboard accessibility.
- Active / Pressed: Visual indentation or color shift reflecting touch/click engagement.
- Disabled: Reduced opacity (40-60%), non-interactive cursor, with tooltip explaining why if applicable.
- Loading: Replace content with skeleton loaders or spinners. Disable double-submits.
- Empty State: Provide helpful illustrations, friendly context, and an actionable next step rather than a blank canvas.
- Error State: Display inline, actionable error messages right next to the failed control. Explain how to fix the issue.

### 5. Accessibility (a11y) Standards

- Maintain color contrast: Meet WCAG 2.1 AA minimums (at least 4.5:1 for normal text, 3:1 for large text and UI components).
- Keyboard navigability: Ensure all features can be navigated using Tab, Enter, Space, and Arrow keys with a logical tab order.
- Meaningful labels and ARIA: Provide aria-label or accessible names for icon-only buttons, form controls, and dynamic regions.
- Touch target sizing: Keep touch targets at least 44x44px on touchscreens.

### 6. Terminal and CLI UX Design

When designing for command-line tools and terminal interfaces:

- Scannable output: Use concise headers, structured tables, and bullets instead of long unbroken walls of text.
- Semantic terminal colors: Use ANSI colors purposefully (green for success, red for errors, yellow for warnings, cyan/dim for tips or secondary data).
- Activity indicators: Use spinners or progress bars for operations taking longer than 1 second.
- Error guidance: Format error messages with three components: what went wrong, why it occurred, and the exact command to resolve it.
- Non-interactive mode: Automatically detect CI/non-TTY environments and provide clean, unstyled output or a --json flag.

## Step-by-Step UI/UX Workflow

1. Understand the User and Intent

   - Identify the primary goal, user persona, and task frequency.
   - Prioritize high-frequency actions and remove unnecessary steps.

2. Structure the Information Architecture

   - Group related tools, pages, or options into intuitive sections.
   - Limit top-level navigation choices to 5-7 items.

3. Establish Design Tokens

   - Define color variables, typography sizes, border radiuses, and spacing increments.
   - Keep token names semantic (e.g., surface-default, text-muted).

4. Build and Assemble Components

   - Implement reusable atomic components (buttons, badges, inputs, dialogs).
   - Ensure components encapsulate their own states (hover, focus, loading, error).

5. Test Usability and Polish

   - Review contrast ratios, tab order, and responsive scaling.
   - Verify that feedback is immediate and destructive actions require confirmation.

## Gotchas to Avoid

- Do not use color as the sole indicator of status or errors (always pair color with icons or descriptive text).
- Do not hide critical actions inside nested menus if they are part of the core user workflow.
- Do not block the interface during asynchronous tasks without showing a loading indicator.
- Do not clear user inputs upon validation errors (preserve form data and highlight the invalid fields).
- Do not use unstyled, raw error stack traces in user-facing CLI or UI views.
