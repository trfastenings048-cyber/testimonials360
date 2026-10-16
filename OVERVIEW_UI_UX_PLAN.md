# Overview (`/admin/overview`) UI/UX Plan: Upload Modal and Content Table

Scope: the two sections of `/admin/overview`:
1. **Upload new content.** The inline form becomes a header button that opens a modal.
2. **Content library.** The scrolling list becomes a proper data table.

Style: everything follows the big-screen look already applied to the admin (`ADMIN_DISPLAY_STYLE_PLAN.md`): white 24px cards, the `bg-signature` gradient with arches, navy pills, Outfit and Geist Mono.
Source today: `src/components/admin/OverviewPage.tsx` (289 lines). The upload and visibility logic is reused unchanged, and so is `uploadImageToDB` with its `signal` support.

---

## 1. Problems with the page today

| # | Problem | Impact |
|---|---|---|
| O1 | The upload form always takes up the top half of the page, even though uploading is occasional | The library, which is the thing you manage, sits below the fold |
| O2 | Choosing a file uses the native `<input type=file>`; no drag and drop, no paste | Slow on a laptop during an event |
| O3 | The hint says "unique group name", but nothing checks it. The big screen shows **only the newest photo per group** (`getDisplayGroupImages`), so reusing a name silently replaces what's on screen | Surprise changes on the big screen |
| O4 | The upload can't be cancelled, and progress is just a number in the button | Stuck on a slow upload |
| O5 | The library is an unsorted list with no search, filter, paging or bulk actions | Hard to manage more than about 20 groups |
| O6 | Nothing distinguishes a photo that's **on screen** from one that's visible but **replaced** by a newer upload in the same group | Admins can't tell what the room sees |
| O7 | No full-size preview | You have to download a photo to check it |

---

## 2. Page layout

```
┌ PageHeader ───────────────────────────────────────────────────────────────┐
│ Workspace overview                                                        │
│ Overview                                          [ ⬆ Upload new content ]│  ← navy pill button
│ Upload, organise and control the group photos…                            │
└───────────────────────────────────────────────────────────────────────────┘
┌ StatCard: signature ┐┌ StatCard ──────┐┌ StatCard ─────┐┌ StatCard ────────┐
│ On the big screen   ││ Total photos   ││ Hidden        ││ Last upload      │
│ 4 groups            ││ 12             ││ 3             ││ 2 min ago · Riya │
└─────────────────────┘└────────────────┘└───────────────┘└──────────────────┘
┌ Content library (admin-card, table) ──────────────────────────────────────┐
│ [🔍 Search groups…]   ( All | On screen | Hidden )            12 photos   │
│ ☐ │ Photo │ Group ▲      │ Uploaded ▼        │ Status        │ Show │  ⋯   │
│ ☐ │ [img] │ Riya         │ 16/10/26 14:02    │ ● On screen   │ ◉    │ ⬇ 🗑 │
│ ☐ │ [img] │ Riya         │ 15/10/26 09:10    │ ○ Replaced    │ ◉    │ ⬇ 🗑 │
│ ☐ │ [img] │ Tripti       │ 15/10/26 08:55    │ ○ Hidden      │ ○    │ ⬇ 🗑 │
│ Rows per page [10 ▾]                                 ‹ 1 2 3 ›            │
└───────────────────────────────────────────────────────────────────────────┘
                 ( 2 selected · Show · Hide · Delete · ✕ )   ← floating bulk bar
```

- **Upload button:** a primary navy pill with the `ImagePlus` icon, placed in `PageHeader actions`. The **U** key also opens it when focus isn't in a text field.
- **Stat row (new):** all values come from `images` in `useAdminData()`, so no new API is needed.
  - **On the big screen** (`tone="signature"`): the number of groups whose newest photo is visible, which is exactly what `/display` cycles through.
  - **Total photos.**
  - **Hidden.**
  - **Last upload:** relative time and group name, the time in mono.
- Order on the page: header, stats, table. The upload form is gone from the page.

---

## 3. Upload modal

Built on `@base-ui/react/dialog`, the same primitive as the Videos preview and rename dialogs. That gives focus trap, Esc to close, scroll lock and focus returning to the button.

### 3.1 Look
```
┌──────────────────────────────────────────────── 560px, 28px radius ┐
│ ░░ bg-signature band (96px) with Arches ░░░░░░░░░░░░░░░░░░░░░░░ ✕ │
│ (⬆) Upload new content                                             │
│     The photo appears on the big screen straight away.             │
├────────────────────────────────────────────────────────────────────┤
│ ┌ Drop zone (24px radius, dashed, surface-page/50) ─────────────┐  │
│ │        [ImagePlus]                                            │  │
│ │   Drop a photo here, paste it, or click to choose             │  │
│ │   JPG, PNG, WebP or HEIC                                      │  │
│ └───────────────────────────────────────────────────────────────┘  │
│        ↓ once a file is chosen, the drop zone becomes:             │
│ ┌ Preview (16:9, blurred fill + contain, as on the big screen) ─┐  │
│ │                [photo]          ( Replace )  ( ✕ Remove )     │  │
│ └───────────────────────────────────────────────────────────────┘  │
│  riya-team.jpg · 2.4 MB · 3024×4032                    (mono)      │
│                                                                    │
│  Group name                                                        │
│  [ Riya                                   ▾ ]  ← suggests existing │
│  ⚠ "Riya" is on screen now. This photo will replace it.            │
│                                                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────  68%  (while upload) │
├────────────────────────────────────────────────────────────────────┤
│                               ( Cancel )   [ ⬆ Upload photo ]      │
└────────────────────────────────────────────────────────────────────┘
```
- Popup: `surface-card` at 28px radius, `max-w-[560px]`, over a backdrop of `bg-ink/40 backdrop-blur-sm`. It scales from 96% to 100% with a fade, and only fades under `prefers-reduced-motion`.
- Header band: `bg-signature` with `Arches`, a 40px navy circle icon badge, the title at 20px font-normal in ink, and a subtitle at 13px in `ink/75`. The close button is a 36px white round button with a shadow, like the display's round buttons.
- Preview: reuses the display's `BlurFillImage` (cover blur behind, contain in front) inside a 20px-radius 16:9 frame, so admins see the framing the room will see.
- Footer: Cancel is a white pill; Upload is a navy pill.

### 3.2 Behaviour and states
| State | What happens |
|---|---|
| **Empty** | Drop zone. Click opens the file picker; drag-over highlights (`border-accent-blue bg-accent-blue-soft`). **Ctrl/Cmd+V pastes an image** from the clipboard while the modal is open |
| **File chosen** | Preview, name / size / pixel size (read via `Image()` from an object URL, revoked on change and close), Replace and Remove buttons. Non-image files are rejected inline: "That's not an image." |
| **Group name** | Text input with suggestions from existing group names (a native `<datalist>`, so no new dependency). It's focused automatically after a file is picked. Required; trimmed; capped at 120 characters (the server cap in `api/images/upload`) |
| **Name matches a group already on screen** | Amber note: "'Riya' is on screen now. This photo will replace it." (fixes O3). Matching uses the same trim and lowercase rule as `normalizeGroupName` on the display. A name that matches a hidden group gets a softer note: "Adds to the hidden group 'Riya'." |
| **Uploading** | Inputs are locked. A 3px segmented-style progress bar (ink on slate-200) shows a mono percentage. **Cancel aborts** through an `AbortController` passed to `uploadImageToDB(…, { signal })` (fixes O4). Closing the modal mid-upload asks for confirmation first |
| **Success** | Toast: "Riya is on the big screen". The new row is highlighted in the table for 3 seconds (the same `highlightId` pattern as Videos). The modal closes. A **"Keep open for the next photo"** checkbox in the footer (remembered in `localStorage`) instead resets the form and keeps the modal open, for batch uploads at events |
| **Error** | An inline red message above the footer, using the API's message (`readError`). The file and name are kept so the admin can retry |

The existing dedupe (`[newImage, ...prev.filter(...)]`) stays, so the realtime `image.updated` event can't create a duplicate row.

---

## 4. Content library table

### 4.1 Desktop (md and up)
Inside one `admin-card` with overflow hidden. The header row uses `bg-surface-page/80` with sentence-case muted 12px text; rows are 64px with 1px dividers and a hover of `bg-surface-page/50`.

| Column | Content | Sort |
|---|---|---|
| ☐ | Row checkbox, plus select-all-on-page in the header | |
| Photo | 72×44 thumbnail (`imageSrc(img,'thumb')`), 12px radius. Clicking it opens **Preview** (§4.4) | |
| Group | Name in ink medium; `truncate` with the full name in `title` | ✔ (natural order, like the display: `localeCompare(…, { numeric: true })`) |
| Uploaded | Date and time in `font-display-mono`, with a relative time ("2 min ago") as a tooltip | ✔ default, newest first |
| Status | Shared `Pill` + `Dot`. **On screen** (green, pulsing): visible and newest in its group. **Replaced** (muted): visible, but a newer photo in the group is shown; the tooltip names the date of the one on screen. **Hidden** (amber) (fixes O6) | ✔ |
| Show | `Switch` (existing `toggleVisibility`). Its aria-label names the group | |
| Actions | Download and Delete as ghost round icon buttons; Delete opens the existing `ConfirmDialog` | |

### 4.2 Toolbar
- **Search:** searches group names, debounced by 150ms, with a clear (✕) button.
- **Filter:** a `ToggleGroup` segmented pill with **All · On screen · Replaced · Hidden** and counts in mono.
- **Result count:** "12 photos" on the right.
- **URL state:** filters, sort and page live in the URL (`?q=&status=&sort=&order=&page=`), the same `readQuery` / `updateQuery` pattern as Videos, so a refresh keeps the view.

### 4.3 Paging, bulk actions, states
- **Client-side paging:** the provider already loads every image. Rows per page are 10, 25 or 50. This **reuses the Videos `Pagination` and `SortableHeader`**, moved into `src/components/admin/table/` so both pages share them.
- **Bulk bar:** shown when 1 or more rows are selected. It's a floating white pill with a shadow, fixed at the bottom centre: "3 selected · Show · Hide · Delete · ✕".
  - Show and Hide call `updateImageVisibility` for each row, a few at a time.
  - Delete uses `ConfirmDialog`, with type-to-confirm (`requireText="DELETE"`) for more than 5 rows.
  - Each action ends with one summary toast ("3 photos hidden"), and failures are listed.
- **Loading:** 6 skeleton rows with the table's own column widths, so the layout doesn't jump.
- **Empty library:** the `EmptyState` gets a **primary "Upload new content" button** that opens the modal.
- **No results:** "No photos match 'xyz'" with a "Clear filters" link.

### 4.4 Preview lightbox
A `Dialog` with an ink background and 28px radius, sized to 90vw × 80vh with a 16:9 stage. The image uses `BlurFillImage`.
- Footer: the group name, an uploaded mono timestamp, the status `Pill`, and Show, Download and Delete actions.
- ←/→ steps through the current filtered and sorted rows.

### 4.5 Mobile (below md)
Each row becomes a card: a full-width 16:9 thumbnail at 16px radius, then group, status pill and time, and a bottom row with the Show switch and Download/Delete. The bulk bar and filters stay; the filter pill scrolls horizontally.

---

## 5. Component breakdown

```
src/components/admin/
  OverviewPage.tsx            ← page shell: header + stats + library; owns modal open state
  overview/
    UploadImageDialog.tsx     ← §3: modal, drop/paste, preview, group suggestions, progress, abort
    ContentLibraryTable.tsx   ← §4.1–4.3: toolbar, table, mobile cards, bulk bar, paging
    ImagePreviewDialog.tsx    ← §4.4
    imageStatus.ts            ← on-screen / replaced / hidden derivation (mirrors display grouping)
  table/
    Pagination.tsx            ← moved from VideosPage.tsx (no behaviour change)
    SortableHeader.tsx        ← moved from VideosPage.tsx
    BulkActionBar.tsx         ← floating pill; Videos can adopt it later
src/components/display/useBigScreen.ts
  getDisplayGroupImages / normalizeGroupName → exported via src/lib/display-groups.ts
  so the admin's "On screen" status uses the **same** rule as the screen
```

---

## 6. Delivery phases

| Phase | Work | Done when |
|---|---|---|
| **1. Shared pieces** | Move `getDisplayGroupImages` / `normalizeGroupName` into `src/lib/display-groups.ts` (the display imports it from there). Move `Pagination` and `SortableHeader` to `admin/table/`. Add `imageStatus.ts` | `/display` and `/admin/videos` behave exactly as before; `npm run lint` passes |
| **2. Upload modal** | §3 in full, plus the header button, the U shortcut and the stat row | Upload by click, drag and paste all work; cancelling mid-upload stops it; the replace warning shows for an on-screen group; "keep open" batch flow works; Esc and focus trap work; a new photo appears on `/display` |
| **3. Table** | §4.1–4.3, plus the mobile cards | Sort, search, filter, paging and URL state survive a refresh. On screen / Replaced / Hidden match what `/display` shows. Bulk show, hide and delete work with summary toasts |
| **4. Preview + polish** | §4.4; highlighting a new row; reduced motion; aria labels on every icon button | Keyboard-only run-through works: open the modal, upload, find the row, preview, ←/→, toggle, delete. Screenshots at 1440px and 375px |
| **5. QA** | `npm run lint`, `npm run build`, contrast check of the modal band text on `bg-signature` | All pass |

---

## 7. Open questions (with the default I'll use)

1. **"These two pages."** *Default:* the two sections of `/admin/overview` (upload, and the library table). `/admin/videos` already has a table and an upload sheet. It gets the shared `Pagination`, `SortableHeader` and `BulkActionBar` for free, and could switch its upload sheet to this modal design in a follow-up.
2. **Maximum file size.** Nothing in the code limits it today (the upload goes straight to Cloudinary). *Default:* a soft warning above 20 MB, not a hard block.
3. **Renaming a group.** `PATCH /api/images/[id]` only accepts `isVisible`. *Default:* out of scope; it would need an API change.
4. **Multi-file upload in one go.** *Default:* one photo per upload, with "Keep open for the next photo" for batches, because each photo needs its own group name.
