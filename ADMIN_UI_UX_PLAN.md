# Admin UI/UX Enhancement Plan

Scope: admin sidebar, top navbar, `/admin/overview`, `/admin/testimonials`, `/admin/control`.
Source today: everything lives in one 1,150-line component, `src/components/AdminPanel.tsx`, mounted by each route with a different `initialTab`.

The plan has three parts: an audit of what is wrong now (with line references), the target design for each surface, and phased delivery with acceptance criteria.

---

## 1. Who uses this and what they need

| User | Context | Primary job |
|---|---|---|
| **Event operator** | Standing near the screen at a live event, often on a phone or tablet, under time pressure | Change what is on the big screen *now*: next testimonial, pause, switch to video |
| **Content manager** | Before or during the event, on a laptop | Upload group photos, hide or show them, fix group names |
| **Moderator / organiser** | During and after the event | Review testimonials before they go public, export the attendee list |

Design principles that follow from this:
1. **Live state first.** The admin must always know what the big screen is showing. Today nothing tells them.
2. **Safe by default.** Anything public-facing or destructive needs a clear state, a confirm step, or an undo.
3. **Thumb-friendly controls** on Control (the operator is mobile), and **dense, scannable data** on Testimonials (the moderator is on desktop).
4. **One source of truth for navigation.** The URL decides the active page, never local state.

---

## 2. Cross-cutting audit (all admin pages)

| # | Problem | Where | Impact |
|---|---|---|---|
| G1 | Sidebar, navbar, and every page are one component. Each route remounts the shell and refetches images, certificates, *and* settings, even when the page doesn't need them | `AdminPanel.tsx:182-246` | Flash and spinners on every nav click; slow on event Wi-Fi |
| G2 | Two navigation systems: the sidebar uses `<Link>` (URL), while the mobile tab switcher uses `setActiveTab` (state only) and leaves out Control | `:640-661` | URL and screen drift apart; refresh lands on the wrong tab; Control is unreachable from the tabs |
| G3 | Hardcoded hex colours (`#032b69`, `#00a9b7`, `#e6f6f8`…) everywhere, although `.theme-tr` already defines `--primary`/`--secondary`/`--accent` | whole file, `globals.css:124-143` | Inconsistent shades; no way to retheme |
| G4 | Typography has no scale: 8px, 10px, 0.6rem, 0.7rem, text-xs, and text-sm are mixed. Nav labels are **9.6px** | `:565-610` | Illegible; fails WCAG readability |
| G5 | Icon-only buttons (delete, view, download) have no `aria-label` in several places; checkboxes and switches have no labels | `:782-789, 1001-1008, 1127-1134, 929-934, 1059-1064` | Screen-reader users can't operate the page |
| G6 | `ConfirmDialog` and `CertificateDetailsDialog` don't trap focus, don't close on Esc, and don't lock body scroll | `confirm-dialog.tsx`, `AdminPanel.tsx:64-171` | Keyboard users get lost behind the modal |
| G7 | Loading is a centred spinner; empty states are a single grey line | `:738-742, 914-920` | Layout jumps; empty screens give no next step |
| G8 | The "Live" indicator is static text | `:537` | It gives false confidence that the display is connected |

### Foundation work (fixes G1–G7)

- **Split the shell from the pages.**
  - `app/admin/layout.tsx` → `<AdminShell>` (sidebar + navbar), which persists across routes.
  - `app/admin/overview/page.tsx` → `<OverviewPage>`.
  - `app/admin/testimonials/page.tsx` → `<TestimonialsPage>`.
  - `app/admin/control/page.tsx` → `<ControlPage>`.
  - Shared data comes from an `AdminDataProvider` in the layout. It loads images, certificates, and settings once, keeps them fresh via the existing `/api/stream` SSE, and exposes `useAdminData()`.
- **Delete the mobile tab switcher** (`:640-661`). Navigation comes only from the sidebar or drawer, and the active item comes from `usePathname()`.
- **Design tokens.** Add `--brand-navy`, `--brand-teal`, `--brand-teal-soft`, and `--surface-subtle` to `.theme-tr`. Replace every hex literal with `bg-primary`, `text-secondary`, `bg-accent`, and so on.
- **Type scale** (admin only), with a 12px minimum for any readable text:
  - Page title: 24/32 bold.
  - Section title: 16/24 semibold.
  - Body: 14/20.
  - Meta / labels: 12/16.
  - Eyebrow: 11/16 uppercase, with tracking.
- **New shared components** (shadcn on `@base-ui/react`, already installed): `Sheet` (drawer), `Tooltip`, `DropdownMenu`, `Badge`, `Skeleton`, `Checkbox`, `ToggleGroup` (segmented control), `Slider`, `Textarea`. Plus app-level `PageHeader`, `StatCard`, `EmptyState`, and `StatusPill`.
- **Dialog behaviour.** Rebuild `ConfirmDialog` on base-ui `Dialog` to get focus trap, Esc to close, scroll lock, and focus returning to the trigger. Add a `requireText` prop for type-to-confirm on "Clear all".

---

## 3. Sidebar

### Current state (`AdminPanel.tsx:555-618`)
- Width is `16%` of the viewport: **164px at 1024px and 307px at 1920px**. The content is offset by a matching `lg:ml-[16%] lg:w-[84%]`, so the two are fragile and coupled.
- Nav labels are 9.6px and section labels 8px.
- Desktop and mobile versions are copy-pasted markup (about 60 duplicated lines).
- The "Quick status" card shows raw counts with no meaning ("12 content items").
- The mobile drawer has no Esc handling, focus trap, scroll lock, or open/close animation.
- There is no place for the Display and Portal shortcuts, the connection state, or a future sign-out.

### Target design

```
┌──────────────────────┐
│ [logo] TR Fastenings │  ← brand block, 64px tall, links to /admin/overview
│        Admin         │
├──────────────────────┤
│ MANAGE               │  ← 11px eyebrow
│ ▣ Overview           │  ← 14px label, 40px row, 20px icon
│ ▣ Testimonials   (3) │  ← badge = submissions awaiting review, not the total
│ ▣ Display control  ● │  ← green dot when the display is connected
├──────────────────────┤
│ OPEN                 │
│ ↗ Big screen         │  ← moved here from the navbar; opens /display in a new tab
│ ↗ Participant portal │  ← opens /certificate
├──────────────────────┤
│ (spacer)             │
│ ┌──────────────────┐ │
│ │ NOW SHOWING      │ │  ← replaces "Quick status"
│ │ Testimonials ▶   │ │     mode + playing/paused
│ │ 14 live · 3 hidden│ │
│ └──────────────────┘ │
│ « Collapse           │  ← collapses to a 72px icon rail
└──────────────────────┘
```

### Changes
1. **Fixed width**: `w-64` (256px) expanded and `w-[72px]` collapsed. The content uses `lg:pl-64` / `lg:pl-[72px]`. Collapse state is saved in `localStorage`.
2. **Single source**: a `navItems` config array rendered by one `<SidebarNav>` component, used by both the desktop aside and the mobile `Sheet`.
3. **Active state**: from `usePathname()`. Use a 3px teal left indicator, `bg-accent`, a navy label, and `aria-current="page"`.
4. **Meaningful badges**: Testimonials shows the count *awaiting review* (or "new since last visit", see Decision D1), not the total.
5. **Collapsed rail**: icons only, each with a `Tooltip` for the label; badges become dots.
6. **"Now showing" card**: driven by the display settings and the SSE connection. Clicking it goes to `/admin/control`.
7. **Mobile**: a base-ui `Sheet` from the left, which brings focus trap, Esc, scroll lock, a 200ms slide, and auto-close on route change.
8. **Keyboard**: every item is reachable by Tab with a visible `focus-visible:ring-2 ring-ring`.

**Acceptance criteria**
- No text smaller than 12px.
- Sidebar width is identical at 1024px and 1920px.
- Refreshing on any admin URL highlights the correct item.
- The mobile drawer closes on Esc, on backdrop click, and on navigation.
- axe reports zero violations for the shell.

---

## 4. Top navbar

### Current state (`:534-553`)
- The left side is empty. Everything is pushed right with `ml-auto`, so the bar shows no page title or location.
- Display and Portal buttons use the **same icon** (`ExternalLink`) and lose their text below `sm`, so on mobile they are two identical icons.
- The hamburger sits on the *right*; the convention, and the side the drawer opens from, is the left.
- `rounded-b-xl` plus a sticky navy bar spanning 84% of the width makes it look like a floating tab rather than an app bar.
- The "Live" label is static.

### Target design

```
Desktop:  ┌─────────────────────────────────────────────────────────────────────┐
          │ Admin / Testimonials                     ● Display connected   [⟳] │
          └─────────────────────────────────────────────────────────────────────┘
Mobile:   ┌─────────────────────────────────┐
          │ ☰  Testimonials           ● [▶] │   ▶ = jump to Control
          └─────────────────────────────────┘
```

### Changes
1. **A light app bar** (white, bottom border, `h-14`, full content width, square corners), so the navy sidebar is the single strong brand element. Two navy masses currently compete.
2. **Left**: breadcrumb (`Admin / {Page}`) on desktop; on mobile, the hamburger (left) and page title.
3. **Right**:
   - A **real connection status pill** driven by EventSource `readyState`: ● green "Live", ● amber "Reconnecting…", ● red "Offline – changes won't reach the screen".
   - A **refresh** icon button (re-fetches `useAdminData`), with a tooltip.
   - On mobile only: a **quick "Control" button**, so the operator gets to playback in one tap from any page.
4. Display and Portal links move to the sidebar's "Open" section with distinct icons (`MonitorPlay`, `QrCode`).
5. Optional (Phase 5): a global search shortcut `⌘K` that jumps to a testimonial by name or email.

**Acceptance criteria**
- The current page is identifiable from the navbar alone.
- The status pill turns amber within 3s of the SSE connection dropping.
- On mobile the operator reaches play/pause in ≤ 1 tap from any admin page.

---

## 5. Overview page (`/admin/overview`)

### Current state (`:663-799`)
- It is named "Overview & Content" but contains **no overview**: just an upload form and a list.
- Upload:
  - A plain `<input type=file>` with a 56px preview.
  - The form says "unique group name" but **doesn't check uniqueness**. Uploading a duplicate silently supersedes the older image on the display (`BigScreen` keeps the newest per group).
  - No file size or type feedback and no upload progress.
- Library:
  - A fixed `h-[400px]` scroll box with one tiny row per image.
  - No search, filter, or sort.
  - The visibility switch has no text label (only an eye icon).
  - It is not clear which images are actually on the screen (hidden ones and superseded duplicates look the same as live ones).

### Target layout

```
┌ PageHeader ─────────────────────────────────────────────────────────────┐
│ Overview                                         [+ Upload photo]        │
│ What's on the big screen and everything feeding it.                      │
└──────────────────────────────────────────────────────────────────────────┘
┌ KPI row (4 × StatCard, 2×2 on mobile) ──────────────────────────────────┐
│ Groups on screen │ Testimonials live │ Submissions today │ Display mode │
│ 8 of 10          │ 14 · 3 pending ›  │ 27  ↑ vs yesterday│ ▶ Testimon. ›│
└──────────────────────────────────────────────────────────────────────────┘
┌ Needs attention (shown only when non-empty) ────────────────────────────┐
│ ⚠ 3 testimonials awaiting review  [Review]                               │
│ ⚠ "Group A" has 2 uploads – only the newest is shown  [Manage]           │
│ ⚠ Video mode selected but no video URL  [Fix]                            │
└──────────────────────────────────────────────────────────────────────────┘
┌ Content library ─────────────────────────────────────────────────────────┐
│ [Search groups…]   [All | On screen | Hidden]   Sort: [Name ▾]  [▦ | ☰] │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                              │
│ │ thumb  │ │ thumb  │ │ thumb  │ │ thumb  │   ← 16:9 cards, 4/3/2/1 cols │
│ │Group A │ │Group B │ │Group C │ │Group D │                              │
│ │●On scr.│ │○Hidden │ │Superse.│ │●On scr.│   ← status Badge              │
│ │[toggle]⋯│ │[toggle]⋯│ │        │ │[toggle]⋯│   ⋯ = Download, Rename, Delete│
│ └────────┘ └────────┘ └────────┘ └────────┘                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Changes
1. **KPI row**. Each card is clickable and deep-links to the relevant filtered view (for example, "3 pending" → `/admin/testimonials?status=pending`).
2. **"Needs attention" panel**: computed client-side from data already loaded. It turns the overview into a to-do list, which is what an overview should be.
3. **Upload moves into a `Sheet`** opened from the header button, so the library gets the full page.
   - A drag-and-drop **dropzone** with large preview, file name, size, and type validation (images only, max 15MB) before submit.
   - The **group name combobox** suggests existing groups. If the name matches an existing group, an inline warning reads: "This will replace the photo currently shown for *Group A*." The upload button label changes to "Replace photo".
   - **Upload progress** bar (reusing the XHR progress pattern from `uploadFile` in `api.ts`).
   - After success, the sheet stays open with "Upload another" / "Done". The new card is highlighted in the grid for 2s.
4. **Library as a responsive card grid** (no fixed height; the page scrolls).
   - Status badge: **On screen** / **Hidden** / **Superseded** (older duplicate).
   - The visibility switch gets a visible label ("Show on screen"), plus an undo toast: "Group B hidden · Undo".
   - Overflow menu (`DropdownMenu`): Download original, Rename group (later; needs a PATCH field), Delete.
   - Clicking a thumbnail opens a lightbox.
   - Search, a filter segmented control, sort (Name, Newest), and a grid/list toggle that is remembered.
5. **Skeleton cards** while loading. The **empty state** shows an illustration, "No photos yet", and an [Upload first photo] button.

**Acceptance criteria**
- An admin can tell within 5 seconds which groups are on the big screen.
- Uploading a duplicate group name always shows the replace warning.
- All actions are reachable by keyboard, and every icon button has an accessible name.

---

## 6. Testimonials page (`/admin/testimonials`)

### Current state (`:821-1146`)
- **Moderation risk.** The portal saves every submission with `showOnDisplay: true` (`CertificateSystem.tsx:345`), so feedback goes on the public screen *before anyone reads it*. This is the biggest UX gap in the admin.
- **KPIs.** "Selected Records" is shown as a KPI; it is transient UI state, not a metric.
- **Action bar.** "Clear All" (deletes every submission) sits beside "Export CSV" with similar visual weight and only a yes/no confirm.
- **Table.** It has **11 columns**, so it scrolls horizontally on most laptops. Feedback, the most important content for moderation, is truncated to 200px on a single line.
- **Group editing.** The inline group `<select>` is styled as a pill, which invites accidental changes; there is no undo.
- **No bulk show/hide**, only bulk delete.
- **CSV export** always exports *all* records, ignoring the current search or selection.
- **Missing table basics.** No sorting, filtering by status or group, or pagination. It will struggle past a few hundred rows.
- **Details modal.** It is a centred modal with no previous/next, so reviewing 50 entries means 100 open/close clicks.

### Target layout

```
┌ PageHeader ────────────────────────────────────────────────────────────────┐
│ Testimonials                                   [Export ▾]  [⋯ More]         │
│ Review what attendees said and choose what goes on the big screen.          │
└─────────────────────────────────────────────────────────────────────────────┘
┌ Status tabs (with counts) ─────────────────────────────────────────────────┐
│  Pending review (3) │ On screen (14) │ Hidden (5) │ No feedback (9) │ All (31)│
└─────────────────────────────────────────────────────────────────────────────┘
┌ Toolbar ───────────────────────────────────────────────────────────────────┐
│ [Search name, email, organisation, feedback…]  Group [All ▾]  Date [Today ▾]│
└─────────────────────────────────────────────────────────────────────────────┘
┌ Bulk bar (slides in when ≥1 selected, sticky) ─────────────────────────────┐
│ 4 selected   [Show on screen] [Hide] [Export selected] [Delete]   [Clear ×]│
└─────────────────────────────────────────────────────────────────────────────┘
┌ Table ─────────────────────────────────────────────────────────────────────┐
│ ☐ │ Person ↕            │ Feedback                        │ Group ↕ │ Submitted ↕ │ On screen │ ⋯ │
│ ☐ │ Jane Doe            │ "Eye-opening session about the  │ Group A │ 5 min ago   │  [●]      │ ⋯ │
│   │ Engineer · Acme     │  journey of water. Loved the…"  │         │             │           │   │
│   │ jane@acme.com       │                                 │         │             │           │   │
└─────────────────────────────────────────────────────────────────────────────┘
                                                     Showing 1–25 of 31  ‹ 1 2 ›
```

Right-side **detail drawer** (`Sheet`, 480px) when a row is clicked:

```
┌──────────────────────────────── ‹ 3 of 14 › ✕ ┐
│ Jane Doe                                        │
│ Engineer · Acme · jane@acme.com                 │
│ ┌ Preview on big screen ──────────────────────┐ │  ← same styling as BigScreen card
│ │ "Eye-opening session about the journey…"     │ │
│ │ JANE DOE | ENGINEER AT ACME                  │ │
│ └──────────────────────────────────────────────┘ │
│ Group      [Group A ▾]                          │
│ Submitted  16 Oct 2026, 14:02                   │
│ Certificate  ✓ Ready  [Download]                │
│ [ Hide from screen ]   [ Approve & show ]       │  ← primary moderation actions
│ ─────────                                       │
│ Delete submission                               │  ← destructive, de-emphasised, bottom
└─────────────────────────────────────────────────┘
Keyboard: J / K next/previous · A approve · H hide · Esc close
```

### Changes
1. **Moderation workflow**: status tabs plus "Approve & show" / "Hide". This requires Decision D1 (default new submissions to hidden / pending). Even without the schema change, the tabs work on `showOnDisplay` alone.
2. **Table redesign: 11 columns become 6.**
   - **Person** stacks name, role · organisation, and email.
   - **Feedback** gets the widest column, with a 2-line clamp.
   - Relative **Submitted** time, with the absolute time in a tooltip.
   - Sortable headers, `aria-sort`, and a sticky header.
3. **Group is edited in the drawer**, not inline. Each change shows an undo toast.
4. **Bulk bar** with Show, Hide, Export selected, and Delete. Delete reports the count ("Delete 4 submissions?").
5. **"Clear all" moves into the `⋯ More` menu** with a type-to-confirm dialog (type `DELETE`). An optional "Export a backup first" checkbox is ticked by default.
6. **Export menu**: "Current view (n)", "Selected (n)", "All (n)". The CSV escapes all fields; today only feedback is escaped (`:473`).
7. **Detail drawer** replaces the modal. It adds previous/next, keyboard shortcuts, and an exact **preview of the big-screen card**, so the moderator sees what the audience will see.
8. **Pagination**: 25/50/100 per page. Filters, sort, and page sync to URL query params (`?status=pending&group=A&page=2`), so links from Overview work and refresh keeps the view.
9. **Mobile**: keep the card list, but each card opens the same drawer (full-screen on mobile). Selection uses a long-press "Select" mode instead of always-visible checkboxes.
10. **Real-time**: when SSE fires `certificate-submitted`, show a non-intrusive "2 new submissions · Show" pill at the top of the table rather than reflowing rows under the moderator's cursor.

**Acceptance criteria**
- The table fits a 1280px viewport without horizontal scroll.
- A moderator can review 20 testimonials using only the keyboard.
- "Clear all" can't be triggered by two accidental clicks.
- Export respects the current filters.
- A filtered URL can be shared and reproduces the view.

---

## 7. Control page (`/admin/control`)

### Current state (`:801-819`)
- One card with two mode buttons, Left/Right, and Play/Pause. **The admin can't see what's on screen.**
- Play/Pause state is a local guess (`isPlaybackPaused`, `:203`). It starts as "playing" even if the display is paused, and it desyncs when someone uses the controls on the display itself.
- Commands are fire-and-forget. Only failures toast; success gives no feedback.
- The warning says "Add a video URL before using video playback", but **there is no field to add one**. A dead end.
- The API already supports `testimonialAutoPlay`, `testimonialDurationMs` (1–60s), `videoAutoplay`, and `videoLoop`, but none have UI.
- Mode switching happens instantly, with no confirmation, while an audience is watching.
- Small default buttons, not suited to an operator using a phone.

### Target layout

```
Desktop (two columns, 7/5):
┌ PageHeader ─────────────────────────────────────────────────────────────┐
│ Display control                         ● Live · 1 screen connected      │
└──────────────────────────────────────────────────────────────────────────┘
┌ Live preview ─────────────────────────┐ ┌ Mode ────────────────────────┐
│ ┌───────────────────────────────────┐ │ │ [ Testimonials | Video ]     │
│ │  scaled <iframe src="/display">   │ │ │ (segmented, confirm switch)  │
│ │  (16:9, pointer-events: none)     │ │ └──────────────────────────────┘
│ └───────────────────────────────────┘ │ ┌ Playback ────────────────────┐
│ Now: testimonial 4 of 14 – Jane Doe   │ │   [ ◀ ]   [ ❚❚ Pause ]  [ ▶ ] │  ← 56px touch targets
│ Next in 3s ▬▬▬▬▬▬▬▬▬▬░░░              │ │   ← / Space / → shortcuts    │
└───────────────────────────────────────┘ └──────────────────────────────┘
                                          ┌ Testimonial settings ────────┐
                                          │ Auto-advance        [●]      │
                                          │ Time per slide  ──●──── 8s   │
                                          │ 14 on screen · Manage ›      │
                                          └──────────────────────────────┘
                                          ┌ Video settings ──────────────┐
                                          │ Video URL [https://…      ]  │
                                          │ ✓ Valid · 2:34 preview ▶     │
                                          │ Autoplay [●]   Loop [●]      │
                                          └──────────────────────────────┘
                                          [Discard]          [Save changes]

Mobile: single column, ordered Playback → Mode → Preview (collapsible) → Settings.
        Playback bar is sticky at the bottom of the viewport.
```

### Changes
1. **Live preview**: a scaled, non-interactive `<iframe src="/display">`. It works today with no backend changes because it subscribes to the same SSE. Below it, a status line shows the current item and a countdown. That needs D3; until then, show mode and playing/paused.
2. **Transport controls**: large buttons (≥ 48px, 56px on mobile), keyboard shortcuts (←, Space, →) with a visible hint, and success feedback (a brief button pulse plus a "Sent" toast).
3. **Truthful play/pause state.** Short term: initialise from settings and update on SSE `display-control` echoes, so all admins stay in sync. Long term (D3): the display reports state back.
4. **Mode switch**: a segmented control with a confirm popover: "Switch the big screen to Video? Everyone watching will see the change." Disable Video, with a reason tooltip, until a valid URL is saved.
5. **Settings forms** for the fields the API already supports, with explicit **dirty state**, Save/Discard, and a "You have unsaved changes" guard on navigation. Mode and playback stay instant (live actions); settings are deliberate (form actions). Separating these two interaction models is the core UX fix on this page.
6. **Video URL validation**: URL format, then load a hidden `<video>` to confirm it plays and read its duration, then show an inline preview.
7. **Remove `/admin/heading-control`**, or repurpose it if D2 adds heading and subtitle to the display.

**Acceptance criteria**
- The operator always sees what the screen is showing.
- Play/Pause matches the real display state after any action, from any device.
- No configuration dead ends: every warning links to the control that fixes it.
- All controls are usable with one thumb on a 375px-wide screen.

---

## 8. Delivery phases

| Phase | Scope | Size | Depends on |
|---|---|---|---|
| **0. Foundations** | Admin layout split, `AdminDataProvider` + SSE, design tokens, type scale, new UI primitives, accessible `ConfirmDialog` | M | — |
| **1. Shell** | Sidebar (fixed width, collapse, single nav source, Now Showing), navbar (breadcrumb, real status pill, mobile Control shortcut), remove mobile tab switcher | M | 0 |
| **2. Control** | Live preview, transport, mode confirm, settings forms (autoplay, duration, video URL/autoplay/loop), dirty state | M | 0, 1 |
| **3. Testimonials** | Status tabs, 6-column table, sort/filter/pagination with URL state, bulk bar, detail drawer with preview + shortcuts, export menu, safe Clear all | L | 0, 1 |
| **4. Overview** | KPI row, Needs-attention panel, upload sheet (dropzone, duplicate warning, progress), card grid with statuses, filters | M | 0, 1, 3 (for deep links) |
| **5. Polish & QA** | Skeletons, empty states, undo toasts, ⌘K, axe audit, keyboard pass, 375 / 768 / 1280 / 1920 visual check | S | all |

Control comes before Testimonials because it carries the live-event risk, and its fixes are small and self-contained.

---

## 9. Decisions needed before building

| # | Question | Recommendation |
|---|---|---|
| **D1** | Should new submissions go on screen automatically? | **No.** Change the portal to save `showOnDisplay: false` and make "Pending review" the default tab. Optionally add an "Auto-approve" switch on the Control page for events that want instant display. |
| **D2** | Should the display show the `heading` / `subtitle` fields that already exist in `DisplaySettings`? | Yes, as an optional title strip on `BigScreen`. Edit it on the Control page. Otherwise, drop the fields and delete `/admin/heading-control`. |
| **D3** | Should the display report its state (current item, paused, connected count) back to admin? | Yes. A small addition to `src/server/realtime.ts`: the display POSTs a heartbeat with its state every few seconds, and the server tracks connected clients. This unlocks the truthful status pill, "1 screen connected", and the "Now: 4 of 14" line. |
| **D4** | Authentication | Out of scope here, but the sidebar footer reserves space for the user and sign-out, and it should be done before go-live (see `PROJECT_OVERVIEW.md` risk #1). |

---

## 10. Files that will change

| File | Change |
|---|---|
| `app/admin/layout.tsx` (new) | Shell + data provider |
| `app/admin/{overview,testimonials,control}/page.tsx` | Render the new page components |
| `app/admin/heading-control/` | Delete (or repurpose, per D2) |
| `src/components/AdminPanel.tsx` | Split into `src/components/admin/*`: `AdminShell`, `SidebarNav`, `AdminNavbar`, `OverviewPage`, `TestimonialsPage`, `TestimonialDrawer`, `ControlPage`, `UploadSheet`, `StatCard`, `PageHeader`, `EmptyState`, `StatusPill` |
| `src/components/admin/AdminDataProvider.tsx` (new) | Shared fetch + SSE + connection state |
| `src/components/ui/*` | Add sheet, tooltip, dropdown-menu, badge, skeleton, checkbox, toggle-group, slider, textarea; rebuild confirm-dialog |
| `app/globals.css` | Brand tokens + admin type scale; remove one-off `.admin-*` classes once unused |
| `src/components/CertificateSystem.tsx` | `showOnDisplay: false` (if D1 is accepted) |
| `src/components/BigScreen.tsx` / `src/server/realtime.ts` | Heading strip (D2), state heartbeat (D3) |
