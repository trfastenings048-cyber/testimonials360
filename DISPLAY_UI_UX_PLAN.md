# Big Screen (`/display`) UI/UX Redesign Plan

Scope: the public big-screen page at `/display` (`app/display/page.tsx` → `src/components/BigScreen.tsx`).
Goal: match the supplied mockup. Every realtime behaviour stays exactly as it is today: Ably commands, presence, mode switching, video playback, audio unlock and fullscreen.

The plan has five parts: how the current screen differs from the mockup, the target layout spec, the component breakdown, phased delivery with acceptance criteria, and open questions (each one already has a default).

---

## 1. Current vs. target

| Area | Today (`BigScreen.tsx`) | Mockup |
|---|---|---|
| Canvas | Full-bleed photo with a white-to-navy gradient over it (`:465`, `:499`) | Light grey-blue page with an inset, rounded **image stage** (~66% of height) and a **bottom row of two cards** (~24%) |
| Photo fit | `object-contain`, with gradient bars beside the photo | `contain` on a **blurred, cover-scaled copy of the same photo**, so there are no empty bars |
| Top-left | Navy circular pause button and a group pill with 📷 emoji (`:501-518`) | White **"● Autoplay"** status pill (green dot) |
| Top-right | Fullscreen button only (`:415`) | White pill showing the **group name** and a navy **`01 / 02` counter chip**, then a separate round **fullscreen** button |
| Slide nav | Navy arrows centred on the left and right edges (`:520-536`) and a 1px progress line at the bottom (`:538`) | One floating white **control pill** at the bottom centre of the stage: prev, large navy pause/play, next, **segmented progress**, and a monospace `01 / 03` counter |
| Testimonial | Frosted card laid over the photo; small italic text, 0.6–1.1rem (`:545-586`) | Separate card on the **left (~65%)**: light-to-bright blue gradient, decorative arch lines, navy quote badge with a "Testimonial" label, **large light-weight quote** (~30px at 1211px wide) |
| Speaker | Small uppercase "NAME \| role" line inside the quote card | Separate white card on the **right (~35%)**: initial avatar, name, "designation at team", divider, **"Up next" + next speaker** |
| Testimonial controls | Three navy buttons in the card corner (`:588-621`) | None on screen. They are controlled from `/admin/control` |
| Typography | Geist, many arbitrary rem sizes | Geometric sans (Outfit-style) and a mono face for counters, on a short, deliberate type scale |

---

## 2. Target layout spec (designed for 16:9; 1920×1080 is the reference)

Sizes use `vw`/`vh` with `clamp()` so the same screen works on a 1280×720 laptop and a 4K TV. Pixel values are for 1920×1080.

```
┌──────────────────────────────────────────────────────────── page bg #E9EDF3, padding 2.2vw ─┐
│ ┌─ STAGE  rounded-[28px] · 1px border slate-300/60 · bg gradient slate-100→slate-200 ─────┐ │
│ │ (● Autoplay)                                           ( Riya [01 / 02] )  (⤡)         │ │
│ │                                                                                        │ │
│ │                    photo: contain, over a blurred cover copy of itself                 │ │
│ │                                                                                        │ │
│ │                  ( ‹  [⏸]  ›   ━━ ── ──   01 / 03 )   ← control pill                   │ │
│ └────────────────────────────────────────────────────────────────────────────────────────┘ │
│  gap 1.6vh                                                                                 │
│ ┌─ TESTIMONIAL CARD  (1.85fr) ─────────────────────────┐ ┌─ SPEAKER CARD  (1fr) ──────────┐ │
│ │ (❝) Testimonial                              ╭──╮    │ │ (S)  Sivaranjani               │ │
│ │ "Quote, one to three sentences"           ╭─╯  ╰─╮  │ │      JNVU at GGGJ              │ │
│ │                          gradient #E8EEFF → #5B8CFF │ │ ────────────────────────────── │ │
│ └──────────────────────────────────────────────────────┘ │ Up next        Next speaker    │ │
│                                                          └────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Grid:** `h-screen grid grid-rows-[1fr_auto] gap-[1.6vh] p-[2.2vw]`. The bottom row is `grid grid-cols-[1.85fr_1fr] gap-[1.4vw] h-[24vh]`.

### 2.1 Tokens (add to `globals.css` in a `.theme-display` scope)
| Token | Value | Use |
|---|---|---|
| `--display-bg` | `#E9EDF3` | Page background |
| `--display-stage-from` / `-to` | `#EEF1F6` / `#D5DBE5` | Stage gradient when no photo is showing |
| `--display-ink` | `var(--brand-navy-deep)` `#021D47` | Pause button, counter chip, quote badge, headings |
| `--display-muted` | `#5B6475` | Sub-labels ("JNVU at GGGJ", "Up next") |
| `--display-quote-from` / `-to` | `#E8EEFF` / `#5B8CFF` | Testimonial card gradient (diagonal, top-left to bottom-right) |
| `--display-live` | `#22C55E` | Autoplay dot |
| `--display-paused` | `#F59E0B` | Paused dot |
| Card radius | `24px`; stage `28px`; pills `9999px` | |
| Card shadow | `0 10px 30px -12px rgb(15 23 42 / .18)` | Cards, pills, control bar |

### 2.2 Type scale
- **Font:** Outfit Variable (`@fontsource-variable/outfit`, the same delivery as the existing Geist package), applied to `/display` only. Counters use Geist Mono (`@fontsource-variable/geist-mono`).
- **Quote:** `clamp(22px, 2.4vw, 46px)`, weight 300, leading 1.25. It steps down automatically by length: >140 characters → 0.85×, >220 → 0.72×, then `line-clamp-3`.
- **Speaker name:** `clamp(18px, 1.6vw, 32px)`, weight 500. **Role:** 0.6× name, muted.
- **Pills and labels** ("Autoplay", "Testimonial", "Up next"): `clamp(11px, .85vw, 16px)`, weight 500.
- **Counters:** mono, `clamp(13px, 1.1vw, 20px)`, tabular numbers, current value in ink and total at 60%.

### 2.3 Element specs
1. **Status pill (top-left of stage).** White pill with a 6px dot and a label.
   - States: Autoplay (green) · Paused (amber) · Reconnecting… (grey, `WifiOff` icon, shown when `connection === 'offline'`; replaces today's separate badge at `:426`).
2. **Group chip (top-right).** White pill holding `groupName` and a navy rounded counter chip `01 / 02` (zero-padded). Hidden when there are no groups.
3. **Fullscreen button.** 40px white circle with a `Maximize`/`Minimize` icon, placed next to the chip. Fades out after 3s without pointer movement, so it doesn't sit on screen during the event.
4. **Photo.** Two layers inside the stage:
   - Back layer: the same image with `object-cover`, `blur-3xl scale-110 opacity-60`.
   - Front layer: `object-contain`.
   - Keeps the existing slide variants (`:59-69`) and the 0.75s ease. Shows an empty-state placeholder (image icon and "Waiting for group photos…") when there are no groups.
5. **Control pill (bottom centre, 4% above the stage edge).** White pill containing, in order:
   - Prev (36px white circle).
   - Pause/Play (48px navy circle).
   - Next (36px white circle).
   - Segmented progress: one 3px segment per group, up to 8 segments; above 8 it becomes a single continuous bar. Done segments are ink, the active segment fills with `progress`, the rest are slate-200.
   - Counter.

   It drives the **group banner** (`showPreviousGroup`, `setIsPaused`, `showNextGroup`, `progress`). It is hidden when there are fewer than 2 groups.
6. **Testimonial card.**
   - Gradient background with decorative SVG arch outlines (2 nested arches, `stroke-white/50`, anchored bottom-right, `aria-hidden`).
   - Header: a 36px navy circle with a white `Quote` icon and the label "Testimonial".
   - Quote animates with the existing fade-up (`:549-553`).
   - Empty state: the group name and the "Group capture…" line (keeps today's behaviour from `:576-583`).
7. **Speaker card.** White card.
   - Top: a 64px avatar circle (slate-100) showing the first initial (later a photo, if one is ever added), then the name and "designation at team" (same join as `:565`, with "Participant" as the fallback).
   - Bottom, after a divider: "Up next" on the left and the next testimonial's `userName` on the right.
   - The whole card cross-fades with the testimonial. "Up next" is hidden when there are fewer than 2 testimonials.
8. **Video mode** (`:432-461`). Plays inside the **same stage frame**, `object-contain` on a navy-deep background. The bottom row then shows a "Now playing" card on the left (the video title) and the speaker card's place collapses, so the stage can grow to full height (`grid-rows-[1fr_0]` with a transition). The "Tap the screen once to turn on sound" toast moves into the control-pill position. Native `controls` stay.

### 2.4 Motion
- Photo: the existing horizontal slide.
- Testimonial and speaker cards: fade plus 12px rise, staggered by 80ms.
- Segmented progress fill is driven by the existing `progress` state; the 50ms step stays.
- Respect `prefers-reduced-motion`: slide becomes a cross-fade, rise becomes fade only.

---

## 3. Component breakdown

`BigScreen.tsx` is 626 lines with all logic and markup in one file. Split it so that **logic doesn't move** and only the presentation is replaced:

```
src/components/display/
  useBigScreen.ts        ← lines 72-402 moved as-is: state, Ably handlers, presence, timers, fullscreen;
                           returns a typed view model (also exposes nextTestimonial)
  BigScreen.tsx          ← layout grid only; composes the pieces below
  StageFrame.tsx         ← rounded stage, slot for media + overlays
  BlurFillImage.tsx      ← blurred cover + contain image pair (next/image, unoptimized)
  StatusPill.tsx         ← autoplay / paused / reconnecting
  GroupChip.tsx          ← name + counter chip
  SlideControls.tsx      ← prev / play-pause / next + SegmentedProgress + counter
  TestimonialCard.tsx    ← gradient card, arches, quote with length-based sizing
  SpeakerCard.tsx        ← avatar, name, role, up next
  VideoStage.tsx         ← video element + audio-unlock hint
  format.ts              ← pad2(), initials(), speakerRole()
```

`app/display/page.tsx` imports the new `display/BigScreen`. The old file is deleted at the end of phase 3.

---

## 4. Phased delivery

### Phase 1: Foundation (no visual change yet)
- Add the Outfit and Geist Mono fontsource packages and the `.theme-display` tokens.
- Move the logic into `useBigScreen.ts` and confirm the existing UI still works on top of the hook.
- **Done when** `npm run lint` passes and `/admin/control` can still drive next/prev/pause for testimonials and the banner, switch to video, and play/pause the video.

### Phase 2: New layout
- Build the grid, StageFrame, BlurFillImage, StatusPill, GroupChip, fullscreen button, SlideControls, TestimonialCard and SpeakerCard.
- Remove the gradient overlay, the edge arrows, the bottom progress line and the on-card testimonial buttons.
- **Done when** a screenshot at 1920×1080 matches the mockup's proportions (stage ≈ 66% of height, cards ≈ 24%, card split ≈ 65/35), and nothing overflows or clips at 1280×720 or 3840×2160.

### Phase 3: States and edge cases
- Cover these combinations:
  - 0, 1 and many groups; 0, 1 and many testimonials.
  - Quotes over 220 characters; names over 30 characters (truncate with an ellipsis).
  - More than 8 groups (continuous bar).
  - Offline (Reconnecting… pill).
  - Paused (amber pill, play icon in the control pill).
  - Video mode, both with a video and with none.
- Reduced motion; fullscreen button auto-hide.
- **Done when** each state has been checked in the browser preview, with a screenshot for each one.

### Phase 4: Polish and accessibility
- `aria-label`s on all icon buttons and `aria-live="polite"` on the quote.
- Text contrast ≥ 4.5:1 on the blue end of the gradient: the quote text is navy-deep, and placement is checked against `#5B8CFF`.
- Keyboard shortcuts on the screen itself: ←/→ change the group, Space pauses, F toggles fullscreen.
- **Done when** `npm run lint` and `npm run build` pass and the realtime regression check from phase 1 is repeated.

---

## 5. Open questions (with the default I'll use)

1. **Which slideshow do the two counters track?** The mockup shows `01 / 02` in the top chip and `01 / 03` in the control pill.
   - *Default:* both show the **group banner** position. The mockup numbers are placeholders.
   - *Alternative:* the control pill steps through testimonials instead.
2. **Font.** *Default:* Outfit, on `/display` only. The admin pages keep Geist.
3. **Testimonial controls on the big screen itself.** *Default:* removed, as in the mockup. The operator uses `/admin/control`, and the keyboard shortcuts from phase 4 cover local use.
4. **Brand colours.** The mockup's periwinkle blue isn't one of the TR navy/teal brand colours. *Default:* follow the mockup. The token can be swapped for `--brand-teal` in one line if the brand team prefers.
