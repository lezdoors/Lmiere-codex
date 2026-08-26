---
name: Lmiere
description: A recovered optical field instrument for clear, pay-per-generation image and motion creation.
colors:
  paper: "#eee6d6"
  paper-light: "#f4eddf"
  cobalt: "#153e78"
  studio-canvas: "#f5f4ef"
  studio-panel: "#eeece5"
  studio-ink: "#20231f"
  night: "#03100d"
  night-panel: "#061913"
  signal: "#a6dc91"
  sulfur: "#e9ad00"
  electric: "#1727ff"
  electric-paper: "#fbfaf4"
  phosphor: "#b7ffd2"
typography:
  display:
    fontFamily: "Bodoni Moda, serif"
    fontSize: "clamp(3rem, 8vw, 8.25rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Bodoni Moda, serif"
    fontSize: "clamp(2.375rem, 3.2vw, 3rem)"
    fontWeight: 500
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  body:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "0.5625rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
  index:
    fontFamily: "Bodoni Moda, serif"
    fontSize: "clamp(1.1875rem, 2vw, 1.6875rem)"
    fontWeight: 400
    lineHeight: 0.9
rounded:
  square: "0"
  signal: "50%"
spacing:
  xs: "8px"
  sm: "14px"
  md: "24px"
  lg: "34px"
components:
  button-studio:
    backgroundColor: "{colors.cobalt}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 11px"
    height: "50px"
  input-studio:
    backgroundColor: "rgba(255, 255, 255, 0.52)"
    textColor: "{colors.studio-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "14px 15px"
  button-network:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.night}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "16px 22px"
---

# Design System: Lmiere

## Overview

**Creative North Star: "The Recovered Optical Instrument"**

Lmiere combines the authority of an archival field manual with the immediacy of a working render machine. The public surfaces feel discovered, measured, and editorial; commercial surfaces become calmer and more direct without losing the same typographic voice. Empty space is operational: it isolates the next decision and gives generated work visual authority.

The system is intentionally route-specific rather than uniformly themed. Warm paper sells the idea, a north-lit bench supports daily creation, forest-black protects private account activity, and ultramarine presents the archive as a living signal field. These worlds share type, indexing, square geometry, exact prices, and restrained motion.

**Key Characteristics:**

- Monumental editorial type paired with precise monospaced controls.
- Square, measured structures with thin rules and indexed sequences.
- One dominant palette per route; palettes never blend within a screen.
- One authored motion event on showpiece surfaces and direct state feedback elsewhere.
- Generated media receives more space than interface chrome.

## Colors

The palette moves between paper, instrument, private network, and electric archive worlds while keeping one accent rare within each route.

### Primary

- **Oxidized Cobalt:** the brand ink and primary action on paper and studio surfaces.

### Secondary

- **Living Signal:** account and wallet copy on the private network surface.
- **Electric Archive:** the archive's field color and image-treatment ink.

### Tertiary

- **Sulfur Signal:** price, focus, and state only; never broad decoration.
- **Phosphor Signal:** a bounded green used only inside the Chapter IV canvas/video artifact; it never becomes interface chrome.

### Neutral

- **Recovered Paper:** the landing canvas and documentary base.
- **North-Lit Mineral:** the brighter studio canvas and working panels.
- **Optical Charcoal:** studio notation, borders, and long-form controls.
- **Forest Black:** the protected account and checkout field.
- **Electric Paper:** the archive's high-contrast content surface.

### Named Rules

**The One World Rule.** A route uses one declared palette; paper, studio, network, and archive colors do not mingle inside the same screen.

**The Rare Signal Rule.** Sulfur marks price, focus, or live state. If it becomes decorative background color, the hierarchy is broken.

## Typography

**Display Font:** Bodoni Moda (with serif fallback)
**Body Font:** IBM Plex Mono (with monospace fallback)
**Label/Mono Font:** IBM Plex Mono

**Character:** Bodoni Moda gives concepts and outcomes cinematic scale; IBM Plex Mono makes instructions, prices, and provenance feel audited. There is no third display voice.

### Hierarchy

- **Display** (400, fluid 48–132px, 0.9): landing statements, archive titles, and major private-account values.
- **Headline** (500, fluid 38–48px, 0.94): task questions and sectional outcomes.
- **Title** (400–500, fluid 25–44px, about 1): wordmarks, result titles, and record names.
- **Body** (400, 14px, 1.55): prompts and task guidance; keep explanatory passages compact.
- **Label** (400–500, 8–10px, 0.08em, uppercase): navigation, step numbers, status, price labels, and metadata.
- **Index** (400, 19–27px, 0.9): Roman numerals inside the desktop Field Index; compact mode returns them to the 8px label scale.

### Named Rules

**The Two-Voice Rule.** Bodoni owns ideas; Plex Mono owns actions and evidence. Never add another decorative font to create variety.

## Layout

Showpiece pages use large editorial fields interrupted by thin rules and indexed evidence. The studio uses a two-column optical-bench layout: a compact decision rail and a dominant output field. Account and checkout use bordered ledgers and measured grids. The archive uses a spacious three-column record index that reduces to two columns and then one.

Primary route padding is 24–34px on desktop. At 860px, navigation compresses, commercial grids become a single reading column, media stays in flow, and controls remain at least 44px tall. The canvas must never introduce horizontal scrolling at 320px.

**The Output-First Rule.** On creation and archive routes, generated media is the largest surface. Interface chrome supports the result and does not compete with it.

## Elevation & Depth

Lmiere is flat by default. Paper grain, tonal panels, one-pixel rules, image treatment, and foreground motion create depth. The studio output field alone receives a soft ambient shadow to separate the active result from the optical bench. Private screens use translucent dark panels rather than stacked cards.

**The Flat Instrument Rule.** Controls and content remain planar at rest; depth appears only around the focal media or as a response to interaction.

## Shapes

The form language is rectilinear: zero-radius controls, square seals, thin rules, and diagram-like frames. Circles are reserved for optical signals, lenses, status dots, and the brand star's orbit—not generic card styling.

## Components

### Buttons

- **Shape:** square and instrument-like (0 radius), with a minimum 44px touch target.
- **Primary:** solid route accent, uppercase mono label, and an explicit directional cue.
- **Hover / Focus:** invert to the route canvas or reveal an underline; keyboard focus uses a sulfur 2px outline.
- **Active:** a restrained spring-like compression, never a long decorative transition.

### Cards / Containers

- **Corner Style:** square.
- **Background:** tonal or transparent within the route's own palette.
- **Shadow Strategy:** none by default; focal media may use one soft ambient shadow.
- **Border:** one-pixel route-color rules carry most grouping.
- **Internal Padding:** generally 24–34px on desktop and 16–24px on mobile.

### Inputs / Fields

- **Style:** square, thin-rule fields on a slightly lighter tonal surface.
- **Focus:** cobalt border plus a second one-pixel cobalt ring in the studio; sulfur remains the global keyboard outline.
- **Error / Disabled:** errors are plain text and border shifts, not toast spectacle; disabled actions keep their geometry and reduce opacity.

### Navigation

Navigation is compact mono metadata rather than a conventional app bar. Active destinations are communicated by underline, border, or filled route accent. On mobile, preserve the account and primary studio action while removing low-priority metadata.

### Field Index

The landing page is one six-chapter field instrument: Apparatus, Outcomes, Mechanism, Transmission, Ownership, and Studio. The active chapter occupies the full screen and the compact Roman-numeral rail exchanges chapters in place instead of moving the visitor down a long document. Previous and next controls preserve sequence; arrow keys preserve keyboard flow. Each chapter composes evidence differently, while the rail, type pairing, and one-pixel rules preserve continuity. The index is navigation—not decoration—and never changes the visible URL.

### Indexed Outcome Row

Every generation outcome is a full-width row with an index, outcome name, exact price, and selection mark. Selection uses a faint cobalt wash and blue notation; the three choices remain comparable without opening another panel.

### Optical Output Field

The studio's result frame is the largest bounded region. While idle or running, the interpretation lens and specimen layers may move inside this frame only. The rest of the commercial route stays still.

## Do's and Don'ts

### Do:

- **Do** show an exact price beside every generation outcome before the action.
- **Do** use negative space to isolate one decision or one piece of generated media.
- **Do** keep the static first frame complete and render final states immediately under reduced motion.
- **Do** use step indices, rules, and precise metadata instead of generic dashboard cards.

### Don't:

- **Don't** combine paper, network green, and electric archive palettes on one route.
- **Don't** expose provider names, model IDs, or infrastructure jargon in the default workflow.
- **Don't** add a second smooth-scroll engine or animate commercial surfaces continuously.
- **Don't** replace precise icons with decorative glyph characters or fill empty space with gradients.
