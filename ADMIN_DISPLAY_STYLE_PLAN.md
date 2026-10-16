# Admin Restyle Plan: Match the Big-Screen Look

Scope: every admin surface. That means the shell (sidebar and navbar), `/admin/overview`, `/admin/testimonials`, `/admin/videos`, `/admin/control` and `/admin/login`.
Goal: the admin uses the same visual language as the redesigned `/display`. That covers fonts, colours, the blue gradient, card shapes, pills and shadows.
Out of scope: the participant portal (`/certificate`, `CertificateSystem.tsx`, `ThankYou.tsx`). It shares `src/components/ui/*`, so every shared-component change here has to stay invisible outside the admin (see §5).

---

## 1. What "the display look" is (the reference)

These all come from `src/components/display/*` and the `.theme-display` block in `app/globals.css`.

| Element | Display value |
|---|---|
| Body font | **Outfit Variable**: light (300) for large text, medium (500) for names and labels. Never bold |
| Number font | **Geist Mono Variable**, tabular figures, used for counters such as `01 / 03` |
| Page background | `#E9EDF3` (cool grey-blue) |
| Surfaces | White cards, **24px** radius, **no border**, soft shadow `0 10px 30px -12px rgb(15 23 42 / .18)` (`display-shadow`) |
| Ink | Navy-deep `#021D47` for text, the pause button and the counter chip |
| Muted text | `#5B6475` |
| Signature gradient | `#E8EEFF → #5B8CFF` at a diagonal, with white outline arches in the bottom-right corner (testimonial card) |
| Pills | White, fully rounded, with a 6px status dot: green `#22C55E` live, amber `#F59E0B` paused |
| Labels | Sentence case, 11–16px, medium, muted. No uppercase eyebrows |
| Avatar | Slate-100 circle showing the first initial |

The admin today is a different system:
- Geist font, with `font-bold` used everywhere.
- A solid navy sidebar.
- Teal (`--brand-teal`) as the accent.
- `admin-card` surfaces: 12px radius with a 1px border.
- Uppercase `text-eyebrow` labels.
- Tinted status pills.

The good news is that the admin already uses **semantic tokens only** (no hex literals in `src/components/admin`). Most of the change is therefore made once in `.theme-tr`, and each component then gets a smaller set of edits.

---

## 2. Foundation: one shared token set

### 2.1 Move the display palette to `:root` and give it neutral names
Both `.theme-display` and `.theme-tr` map onto these, so the two can't drift apart again.

| New `:root` token | Value | Replaces |
|---|---|---|
| `--surface-page` | `#E9EDF3` | `--display-bg`, admin `--surface-subtle` (`#f4f7fb`) |
| `--surface-card` | `#FFFFFF` | |
| `--ink` | `#021D47` | `--display-ink`; becomes admin `--primary` |
| `--ink-muted` | `#5B6475` | `--display-muted`; admin `--muted-foreground` (`#5b6474`, already nearly identical) |
| `--accent-blue` | `#5B8CFF` | `--display-quote-to`; becomes admin `--secondary` for **fills only** |
| `--accent-blue-strong` | `#2F5FD9` | New. Used where blue is **text or icon on white** (#5B8CFF is only 3.2:1 on white; #2F5FD9 is about 5:1) |
| `--accent-blue-soft` | `#E8EEFF` | `--display-quote-from`; becomes admin `--accent` (replaces teal-soft) |
| `--live` / `--paused` | `#22C55E` / `#F59E0B` | Admin `--success` / `--warning` for **dots** (text keeps the darker `#16a34a` / `#d97706`) |

`.theme-tr` then becomes:
- `--background: var(--surface-page)`
- `--card: var(--surface-card)`
- `--primary: var(--ink)`
- `--secondary: var(--accent-blue)`
- `--accent: var(--accent-blue-soft)`
- `--accent-foreground: var(--ink)`
- `--ring: var(--accent-blue)`
- `--border: #E2E7EF` (lighter; borders become rare)
- `--radius: 1rem`

Teal tokens stay defined for the participant portal but are no longer referenced by any admin code.

### 2.2 Shared utilities (`globals.css`)
- `display-shadow`: already exists. Renamed to `surface-shadow` and kept as an alias.
- `surface-card`: `background: var(--surface-card); border-radius: 24px; box-shadow: …`. This **replaces the `admin-card` rules** (23 call sites keep their class name during migration; the rule body changes).
- `bg-signature`: `linear-gradient(135deg, var(--accent-blue-soft) 20%, var(--accent-blue))`.
- `text-eyebrow`: redefined to sentence case, 12/16, medium, `--ink-muted`, no letter-spacing. This updates all 23 eyebrow labels at once. Any copy written in capitals is checked by hand.

### 2.3 Fonts
- Move the `@fontsource-variable/outfit` and `geist-mono` imports from `app/display/page.tsx` to `app/admin/layout.tsx`, as well as keeping them on `/display`.
- `.theme-tr { font-family: var(--font-display) }`. Numbers use `font-display-mono tabular-nums`.
- Weight mapping for every admin file:

  | Now | After |
  |---|---|
  | `font-bold` | `font-medium` |
  | `font-semibold` | `font-medium` |
  | Large numbers / page titles | `font-normal` or `font-light` (as on the display's quote) |

  About 40 occurrences in total, mostly in `TestimonialsPage.tsx` (11) and `VideosPage.tsx` (7).

### 2.4 Shared primitives (new `src/components/shared/`)
These are pulled out of the display so that both apps render the exact same pieces.

| Component | Source | Used by |
|---|---|---|
| `Pill` (white, rounded-full, `surface-shadow`) + `Dot` (tone: live / paused / offline / danger) | `display/StatusPill.tsx` | Display status, admin `StatusPill`, sidebar "Now showing", table status cells |
| `CounterChip` (navy, mono, `01 / 03`) | `display/GroupChip.tsx` | Display, Control page status, Testimonials "position on screen" |
| `Arches` (decorative SVG) | `display/TestimonialCard.tsx` | Display testimonial card, admin hero cards, login |
| `InitialAvatar` | `display/SpeakerCard.tsx` | Display speaker, Testimonials table rows, sidebar user |

The display components then import from `shared/`. They don't change visually.

---

## 3. Shell

### 3.1 Sidebar (`AdminSidebar.tsx`, `AdminShell.tsx`)
**Default: a floating white sidebar.** It becomes a white `surface-card` inset 16px from the viewport edge, matching the display's inset stage.
- Logo block: white logo tile, "TR Fastenings" in muted 12px, and "360 Camera Admin" in ink 15px medium.
- Nav items: 40px rows, 12px radius, ink-muted text. Hover: `bg-accent-blue-soft`. **Active: a navy `--ink` pill with white text**, the same treatment as the display's pause button and counter chip. The 3px teal left bar goes away.
- Section labels: sentence-case eyebrow.
- "Now showing" card (bottom): gets **`bg-signature` with `Arches`**. It's the one place in the shell that carries the gradient, so it reads as the "live screen" preview. Inside it: a `Pill` + `Dot` for status, and the mode and playback text in ink.
- Collapsed (72px) mode keeps the same rules with icon-only items.
- The mobile `Sheet` drawer uses the same white surface.

(Alternative, if a dark sidebar is still wanted: `--ink` background with `bg-signature` used only on the active item. See §7.)

### 3.2 Navbar (`AdminNavbar.tsx`)
- Transparent over `--surface-page` (no white bar and no bottom border), 64px tall.
- Breadcrumb in ink-muted, with the current page in ink medium.
- Right side: the live `StatusPill` rebuilt on `Pill` + `Dot` (white with a coloured dot, replacing the tinted pills), and a refresh button as a 36px white circle with a shadow (same as the display's former round buttons).

### 3.3 Main area
- `bg-surface-page`. Content max width stays at 1400px; vertical rhythm is 24px between cards.

---

## 4. Shared admin components

| Component | Change |
|---|---|
| `PageHeader` | No bottom border. Title 28/36 **font-normal** ink; description in ink-muted 15px; eyebrow in the new sentence case. Actions are pill buttons |
| `StatCard` | `surface-card`, label in muted 13px, value in **Outfit light 36px** with tabular figures. The `secondary` tone uses `--accent-blue-strong`. The **first card on Overview uses the `bg-signature` + Arches variant** (`tone="signature"`) |
| `EmptyState` | Icon in a 48px `accent-blue-soft` circle with an `--accent-blue-strong` icon; title in ink medium |
| `StatusPill` (admin) | Rebuilt on the shared `Pill` + `Dot`. The tooltip stays |
| `ConfirmDialog`, `Sheet`, `Tooltip`, `Sonner` | 24px radius, `surface-shadow`, Outfit. The tooltip becomes an ink pill with white text |

### 4.1 `src/components/ui/*` (shared with the portal)
These change **only through tokens or admin-scoped selectors**, never by editing the default classes the portal relies on:
- **Button:** `--radius` drives `rounded-lg`, so the `.theme-tr` radius makes admin buttons rounder automatically. On top of that, add a `pill` shape variant (`rounded-full`) used by admin call sites. Primary = ink fill; secondary = **white with `surface-shadow`** (the display's round-button look) instead of a teal fill; ghost unchanged. Heights become 36px default and 40px lg in the admin (via the variant, not the defaults).
- **Input, Select, Textarea:** 12px radius, white, 1px `--border`, focus ring `--accent-blue`/40. Picked up through tokens.
- **Switch, Checkbox, Slider, ToggleGroup:** the "on" colour is `--secondary`, which is now accent-blue. ToggleGroup becomes a white pill track with an ink pill thumb, matching the display's control pill.
- **Badge:** fully rounded, sentence case, medium.
  - Tones: neutral (slate-100 / ink), info (`accent-blue-soft` / `accent-blue-strong`), success, warning.

---

## 5. Pages

### Overview (`OverviewPage.tsx`)
- Stat row: the first card uses the signature style (see `StatCard` in §4); the others are white cards.
- Upload panel:
  - `surface-card`.
  - The drop zone is a 24px-radius dashed `--border` area on `--surface-page`, like the display stage before its redesign. The progress bar uses the display's segmented look (ink fill on slate-200).
- Image list: each item is a white row with 16px radius, an 64×64 thumbnail with 12px radius, the group name in ink medium, and the date in muted mono. Visibility is a `Switch`; delete is a ghost icon button.

### Testimonials (`TestimonialsPage.tsx`, 13 table elements)
- The table sits in one `surface-card` (24px radius, overflow hidden).
  - Header row: sentence case, muted 12px, on `--surface-page`.
  - Rows: white with a slate-50 hover and 1px `--border` dividers.
- Each person cell gets an `InitialAvatar`, with name in ink medium and "designation at team" in muted, exactly like the display's `SpeakerCard`.
- "Show on display" is a switch; the status column uses `Pill` + `Dot`.
- Bulk-action bar: a floating white pill at the bottom of the screen with a shadow, the same shape and placement as the display's former control pill.
- Detail / preview drawer: shows the quote **rendered with the display's `TestimonialCard`** (gradient, arches, Outfit light), so admins see exactly what the room will see.

### Videos (`VideosPage.tsx`)
- Same table and card treatment as Testimonials.
- The current "on screen" video row gets a navy `CounterChip`-style "Live" tag.
- Video thumbnails get a 16px radius; the player preview sits on an ink background with a 24px radius, like the display's `VideoStage`.

### Display control (`ControlPage.tsx`)
- **Remove the temporary `style={{ zoom: 0.6 }}`.** Instead, resize the controls properly so the page keeps the same compact footprint:
  - Buttons: h-28 → h-20, icons 36 → 24px.
  - Max width: max-w-2xl → max-w-xl.
- Mode toggle (Testimonials / Video): a white pill track with an ink pill for the active mode.
- Playback sections:
  - `surface-card`.
  - Left / Pause / Right become the display's former control pill: white round buttons around a larger navy pause button, with a `CounterChip` showing the screen's position (`02 / 03`).
  - Pause/Play keeps its accent role, but in ink instead of teal.
- Add a small **live preview card** at the top: the current testimonial rendered with the shared `TestimonialCard` (signature gradient). It ties the control page to what's on screen.

### Login (`AdminLoginForm.tsx`)
- Background goes from a navy gradient to `--surface-page`, with a large `bg-signature` panel and arches behind the form card.
- PIN boxes: 56px white tiles with 16px radius and `surface-shadow`, the digit in Geist Mono; the active box gets an accent-blue ring.

---

## 6. Delivery phases and acceptance criteria

| Phase | Work | Done when |
|---|---|---|
| **1. Tokens & fonts** | §2.1–2.3: shared `:root` tokens, `.theme-tr` remap, `surface-card` / `bg-signature` utilities, eyebrow redefinition, Outfit + Geist Mono on the admin | `npm run lint` passes; every admin page renders in Outfit on the grey-blue page background with white 24px cards; **the participant portal (`/certificate`) looks unchanged in before/after screenshots** |
| **2. Shared primitives** | §2.4: `Pill`, `Dot`, `CounterChip`, `Arches`, `InitialAvatar` in `src/components/shared/`; the display imports them | `/display` screenshots are pixel-identical before and after |
| **3. Shell** | §3: sidebar (expanded, collapsed, mobile drawer), navbar, main area | Navigating all four pages: active state correct, collapse persists, drawer works at 375px, keyboard focus visible |
| **4. Components** | §4: PageHeader, StatCard, EmptyState, StatusPill, dialogs, ui variants | Every variant shows up on at least one page; there are no teal pixels left in the admin |
| **5. Pages** | §5: Overview → Testimonials → Videos → Control → Login, one commit per page | Each page checked at 1440px and 375px with screenshots; upload, toggle, delete, bulk actions, video select, every Control command and PIN login all still work |
| **6. QA** | Contrast audit (all text ≥ 4.5:1, especially anything on the blue end of `bg-signature`), `prefers-reduced-motion`, a weight sweep (`grep font-bold src/components/admin` returns nothing), `npm run build` | All checks pass |

Rough size: phases 1–2 are about half a day, phases 3–4 about a day, and phase 5 about 1.5 days, since Testimonials and Videos are 700 and 976 lines.

---

## 7. Open questions (with the default I'll use)

1. **Sidebar colour.** *Default:* a floating white sidebar (closest to the display). *Alternative:* keep the navy sidebar but switch it to `--ink` and give the active item the signature gradient.
2. **Teal.** *Default:* removed from the admin entirely and replaced by accent-blue. It stays in the participant portal.
3. **Where the gradient appears.** *Default:* it's reserved for "this is what the screen shows" moments: sidebar "Now showing", the first Overview stat, the Control live preview, the Testimonials preview drawer and login. Using it on every card would dilute it.
4. **Control page size.** *Default:* replace the `zoom: 0.6` hack with real sizes at the same visual footprint, as described under Display control in §5.
