# TR Fastening 360 Camera: Project Overview

A Next.js 16 (App Router) + React 19 + Prisma 7 (PostgreSQL) app that runs a live event display, a public participant portal where attendees claim a personalised pledge certificate, and an admin dashboard that controls both.

## How the app fits together

| Layer | What it does | Where |
|---|---|---|
| Public display | Full-screen slideshow of group photos plus rotating testimonials; can switch to a video | `app/display` → `src/components/display/BigScreen.tsx` (logic in `useBigScreen.ts`) |
| Participant portal | Form → pledge PDF generated in the browser → upload → saved as a Certificate record | `app/certificate` → `src/components/CertificateSystem.tsx` |
| Admin dashboard | Upload/hide/delete group photos, moderate testimonials, control the display | `app/admin/*` → `src/components/AdminPanel.tsx` |
| Data API | REST routes for images, certificates, display settings, summary, upload, SSE stream | `app/api/*` |
| Database | `EventImage`, `Certificate`, `DisplaySettings` | `prisma/schema.prisma` |
| Live sync | Server-Sent Events (`/api/stream`) across devices, `BroadcastChannel` for same-browser tabs | `src/server/realtime.ts`, `BigScreen.tsx`, `AdminPanel.tsx` |

### Data model

- **EventImage**: a photo (`url`), its `groupName`, `timestamp`, and `isVisible` (whether it may appear on the display).
- **Certificate**: one participant submission: name, email, organisation (`teamName`), `designation`, the `groupName` they picked, the group photo URL, the generated PDF `certificateUrl`, `feedback`, and `showOnDisplay`.
- **DisplaySettings**: a single row (`id = "default"`) holding display mode (`testimonials` or `video`), `videoUrl`, autoplay/loop flags, and testimonial timing.

### Cross-page update flow

1. Admin changes content, a testimonial, or display settings. `AdminPanel` calls the API, then sends a `content-updated` / `display-settings-updated` / `display-control` message.
2. The server broadcasts the same event over SSE. The display, on the same device or another one, reloads its data or applies the command.
3. When a participant submits a certificate, the portal posts `certificate-submitted`, so the display refreshes its testimonials right away.

---

## Pages

### `/` (root)
- **Purpose:** entry point.
- **Behaviour:** redirects to `/display`.
- **Source:** `app/page.tsx`.

### `/display`
- **Purpose:** the big screen shown at the event.
- **Main component:** `BigScreen`.
- **What it shows:**
  - **Group photo slideshow**, full screen, advancing every 8 s (`GROUP_DURATION`). The newest image per group is used, sorted naturally by group name. Prev/next, pause/play, and a progress bar are included.
  - **Testimonial card**, overlaid at the bottom. It shows only certificates that have feedback text (the `system-intro@gates.com` record is excluded). It rotates every 5 s by default, or the admin-configured duration. Prev/next/pause controls are on the card.
  - **Video mode**, when settings say `mode: 'video'`: a full-screen `<video>` replaces the slideshow. If no URL is set, it shows "No video configured".
  - **Fullscreen toggle** in the top-right corner.
- **Live control:** listens for SSE and BroadcastChannel events. It applies admin commands (play, pause, next, previous, video play/pause), reloads when content changes, and re-reads settings.
- **Notes:** the `heading` and `subtitle` fields in DisplaySettings are stored but **not rendered** on this page. The fallback caption is hardcoded as "Sanitation Sandbox".

### `/certificate`
- **Purpose:** the participant portal, a "Claim your certificate" form for attendees.
- **Main component:** `CertificateSystem`.
- **Flow:**
  1. The page loads all uploaded groups (deduplicated by name, newest kept) into a dropdown with thumbnails.
  2. The participant fills in name, email, organisation, designation (all required), chooses a group (required), and optionally leaves feedback (max 500 chars).
  3. "Generate My Certificate" builds an A4 pledge PDF in the browser (jsPDF) with the participant's name, role, and a fixed pledge text. A preview is shown and confetti fires.
  4. In the background the PDF is uploaded (`/api/upload`), then a Certificate record is saved (`POST /api/certificates`, `showOnDisplay: true`). The display is notified.
  5. Optional side effects: a Google Sheets webhook (empty by default, so disabled), and a formsubmit.co email to `sanitationsandbox@gmail.com`.
  6. The result screen offers Download PDF, Download Selected Photo, Generate Another, and Complete (→ `/certificate/thank-you`). A "Share via email" helper also exists in the code but is not wired to any button.
- **Metadata:** title "TR FASTENING 360 Camera | Certificate".

### `/certificate/thank-you`
- **Purpose:** closing confirmation after a participant finishes.
- **Main component:** `ThankYou`.
- **Content:** "Thank you!" card with two buttons: **Back to Display** (`/display`) and **Generate Another** (`/certificate`).

### `/certificate/management`
- **Purpose:** an older, simpler submissions table, grouped by date.
- **Main component:** `CertificateManagement`.
- **Features:** total / today / selected counts, select and bulk-delete, Clear All, per-row delete, and CSV export.
- **Notes:** the admin dashboard now covers this, and the page is **not linked from the admin navigation**. It looks like a legacy page that can be retired or kept as a fallback.

### `/server`
- **Purpose:** a plain "Submission Summary" list: total participants and each submission's name, email, team, image link, and whether the certificate was generated.
- **Main component:** `ServerDetails`, which reads `GET /api/summary`.
- **Notes:** not linked from the admin navigation. It is a read-only debug or reporting view.

### `/admin`
- **Purpose:** entry point for the dashboard.
- **Behaviour:** redirects to `/admin/overview`.

### `/admin/overview`
- **Purpose:** "Overview & Content", the Content Library.
- **Main component:** `AdminPanel` with `initialTab="content"`.
- **Features:**
  - **Upload New Content:** choose an image and give it a unique group name, then submit (`POST /api/images/upload`).
  - **Content Library:** a list of uploaded photos with a visibility toggle (shows or hides it on the display), download of the original file, and delete with confirmation.
  - **Quick status** sidebar: content item count and submission count.
- **Navigation:** desktop sidebar (≥ lg), mobile slide-out menu, and buttons to open `/display` and `/certificate` in new tabs.

### `/admin/testimonials`
- **Purpose:** moderation of participant submissions.
- **Main component:** `AdminPanel` with `initialTab="certificates"`.
- **Features:**
  - Stat cards: Total Submissions, Submitted Today, Selected Records.
  - Search across name, email, organisation, designation, group, and feedback.
  - Per-row **On display** switch (`showOnDisplay`), which controls whether the testimonial appears on the big screen.
  - Change a submission's **Event Group** from a dropdown.
  - View details in a modal (group photo, all fields, feedback, certificate status), download the certificate, or delete.
  - Select all / bulk delete / Clear All, and **Export CSV**.
  - Responsive: card list on mobile, table on desktop.

### `/admin/control`
- **Purpose:** live control of the display.
- **Main component:** `AdminPanel` with `initialTab="settings"`.
- **Features:**
  - Switch display mode between **Testimonials** and **Video** (saved immediately and pushed to displays).
  - In testimonial mode: Left / Right buttons to move between testimonials.
  - Pause / Play for the display.
  - Warning if Video mode is chosen but no video URL is set.
- **Notes:** there is no UI to set a video URL, heading, subtitle, or testimonial timing, even though the API accepts them. Those fields can only be changed via the API.

### `/admin/heading-control`
- **Purpose:** a former heading editor.
- **Behaviour:** redirects to `/admin/control`. The heading editor no longer exists, so this page is effectively dead.

---

## Shared / supporting code

- **Layout** (`app/layout.tsx`): global metadata ("TR FASTENING 360 Camera"), Geist font, global Toaster.
- **API client** (`src/lib/api.ts`): typed wrappers for every endpoint used by the pages.
- **API routes** (`app/api/*`): `images` (list, upload, patch, delete, download), `certificates` (list, create, bulk delete, patch, delete, download), `display-settings` (get, patch, playback commands), `stream` (SSE), `summary`, `upload`.
- **Types** (`src/types.ts`): `EventImage`, `CertificateRecord`, `SummaryRecord`.
- **Shared UI:** shadcn-style components in `src/components/ui/*`.

---

## Observations and risks

1. **No authentication on any admin or management page.** There is no `middleware.ts`. `/admin/*`, `/certificate/management`, and `/server` are public, and the admin APIs can delete data and change the display. Anyone with the URL can clear all submissions. Add auth (for example, a middleware check or NextAuth) before this goes public.
2. **Hardcoded external recipients.** Each certificate submission emails `sanitationsandbox@gmail.com` through formsubmit.co, and the "Share via email" helper targets `nabeel@redsxp.com`. Move these to config or environment variables, and confirm the recipients are correct.
3. **Dead or unused routes.** `/admin/heading-control` redirects to a page with no heading editor, and `/certificate/management` and `/server` are not linked from the navigation.
4. **Heading and subtitle are stored but never shown** on the display, and the admin has no way to edit them.
5. **"Live" indicator is static.** The "Live" label in the admin header is always displayed, whatever the real connection state.
6. **Git status:** `app/admin/overview`, `app/admin/testimonials`, `app/admin/control`, `app/admin/heading-control`, and `app/api/display-settings` are untracked, and several generated Prisma files and core pages are modified. Commit or review these before deployment.
