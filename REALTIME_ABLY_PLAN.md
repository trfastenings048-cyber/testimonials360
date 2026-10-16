# Display Control over Ably: Plan

**Goal.** From `/admin/control` an operator can:
- press **Testimonials** to make `/display` show the testimonials screen, then step **Left / Right** and **Pause / Play**;
- press **Video** to make `/display` play the **latest uploaded video**, then **Play / Pause** it.

It must feel instant, stay truthful (the admin sees what the screen is really doing), and create **no recurring Vercel traffic**: no polling, no heartbeats, no long-lived functions.

---

## 1. What exists today, and what it costs on Vercel

| # | Mechanism | Where | Vercel cost per tab, 10-hour event day | Verdict |
|---|---|---|---|---|
| R1 | SSE stream: one function held open per display/admin tab | `app/api/stream`, `src/server/realtime.ts` | A function stays alive until max duration, reconnects, repeats: **hours of billed duration per tab** | **Remove** |
| R2 | Postgres `LISTEN/NOTIFY` fan-out | `src/server/realtime.ts` | Doesn't work through the Neon pooler, so broken anyway | **Remove** |
| R3 | Display heartbeat `POST /api/display-status` every 10s | `BigScreen.tsx` (added in Phase 1) | **~3,600 invocations** per display | **Remove** |
| R4 | Admin presence poll `GET /api/display-status` every 10s | `AdminDataProvider.tsx` (added in Phase 1) | **~3,600 invocations** per admin tab | **Remove** |
| R5 | Each playback click is a `PATCH /api/display-settings` | `ControlPage` → `sendDisplayCommand` | 1 invocation per click | **Replace** with a direct Ably publish (0 invocations) |
| R6 | Every content change triggers a refetch of all images and certificates on every screen | `BigScreen.tsx` | (screens × changes) invocations | **Replace** with payloads carried in the message |

After the change, the only Vercel calls are: page loads, one data fetch on load, Ably token issuance (about once per 12 hours per tab), and the admin's own saves (uploads, approvals, mode switches). `/display` is a static client page, so serving it costs no function invocation.

---

## 2. Architecture

```
            ┌──────────── Ably (WebSocket, billed by Ably not Vercel) ────────────┐
            │                                                                    │
            │  channel  display:control   ← commands (next, previous, pause…)   │
            │           + presence        ← each screen's live state            │
            │  channel  display:content   ← content deltas (testimonial approved,│
            │                                video uploaded, image hidden…)       │
            └───▲───────────────▲──────────────────────────────▲────────────────┘
   publish      │      subscribe│+ presence enter/update        │ publish (REST, inside an
   commands     │               │                               │ existing request)
   (0 Vercel)   │               │                               │
        ┌───────┴──────┐  ┌─────┴────────┐            ┌─────────┴───────────┐
        │ Admin        │  │ /display     │            │ Next.js API routes  │
        │ /admin/...   │  │ BigScreen    │            │ (only on real saves)│
        └──────┬───────┘  └──────┬───────┘            └─────────┬───────────┘
               │ GET once on load│ GET once on load              │
               └─────────────────┴──────────► Postgres (Neon) ◄──┘
```

### Principles
1. **Postgres stays the source of truth** for anything that must survive a reload: display mode, current video, approved testimonials. Ably carries changes; it doesn't store state.
2. **Commands go browser to browser.** The admin publishes straight to Ably and the display executes. Vercel isn't involved.
3. **State comes back through Ably Presence.** Each screen enters presence on `display:control` and updates its presence data **only when its state actually changes**. The admin reads presence to learn which screens are connected, what mode they're in, and whether they're paused. No heartbeats.
4. **Messages carry data,** so screens patch local state instead of refetching. For example, `testimonial.approved` carries the testimonial record.
5. **The server publishes with Ably REST** inside requests that already happen, such as approving a testimonial. No extra invocation.

### Channel and message contract (`src/lib/realtime/protocol.ts`, shared by all sides)

**`display:control`**: commands, admin → screens (not persisted, never replayed):

| name | data | Effect on screen |
|---|---|---|
| `testimonials.next` | `{ id, issuedAt }` | Move to the next testimonial |
| `testimonials.previous` | `{ id, issuedAt }` | Move to the previous testimonial |
| `testimonials.pause` / `testimonials.play` | `{ id, issuedAt }` | Pause or resume auto-rotation |
| `video.play` / `video.pause` | `{ id, issuedAt }` | Play or pause the `<video>` |
| `mode.changed` | `{ mode, video: { id, url, title } \| null, issuedAt }` | Switch screen. **Published by the server** after it saves the mode |

**Presence data** (each screen; updated only on change):
```ts
{ mode: 'testimonials' | 'video',
  testimonials: { paused: boolean, index: number, count: number },   // index only on manual nav / pause
  video: { id: string | null, title: string | null, playing: boolean },
  audioUnlocked: boolean }
```

**`display:content`**: deltas, server → screens and admins:

| name | data |
|---|---|
| `testimonial.shown` / `testimonial.hidden` / `testimonial.deleted` | the record, or its `id` |
| `image.created` / `image.updated` / `image.deleted` | the record, or its `id` |
| `video.created` / `video.deleted` | the record, or its `id` |

**Robustness rules**
- Every command carries a unique `id` and `issuedAt`. The screen **dedupes by id** and **ignores commands older than 10s**, so a reconnect can't replay a burst of "next" presses.
- Ably guarantees order per publisher per channel. If a connection drops briefly, Ably resumes it and delivers missed messages, so no refetch is needed. Only after a **`suspended`** state (offline more than 2 minutes) does the screen run the one-time load again to resync.

---

## 3. Authentication and keys

- `ABLY_ROOT_KEY` is **server only.** It is never exposed as `NEXT_PUBLIC_*` and never sent to a browser.
- New route `POST /api/realtime/token?role=display|admin` returns an Ably **TokenRequest** with a 12-hour TTL. That's about one Vercel call per tab per 12 hours, and the Ably SDK renews it automatically through `authUrl`.

| Role | Capability |
|---|---|
| `display` | `display:control`: subscribe + presence. `display:content`: subscribe. **Cannot publish.** |
| `admin` | `display:control`: publish + subscribe + presence (read). `display:content`: subscribe. |

- `ABLY_SUBCRIBE_KEY` isn't needed with token auth. Remove it, or keep it only as an emergency fallback for the display. (Note the spelling: `SUBCRIBE`.)
- ⚠️ **Gap:** `/admin` has no authentication (PROJECT_OVERVIEW risk #1). Without auth, **anyone can request an `admin` token and drive the big screen.** This plan includes a minimal guard (§5, step 1.4); full auth stays a separate decision (D4).

---

## 4. Behaviour, screen by screen

### `/display` (BigScreen)
- **On load:** one `GET /api/display-settings` (mode + current video) plus the existing image and certificate fetches. Connect to Ably as `display`, enter presence, subscribe.
- **Testimonials mode:** today's testimonials screen. Left / Right / Pause / Play arrive as commands. Auto-rotation keeps its local timer, which costs nothing. After any change, presence is updated.
- **Video mode:** a full-screen `<video>` with the video named in `mode.changed`, or else the current video from settings. `video.play` calls `video.play()` and `video.pause` calls `video.pause()`. The `playing`/`paused` events update presence, so the admin's button always reflects reality, including when someone uses the on-screen controls.
- **Autoplay policy (important):** browsers block `play()` with sound when it isn't triggered by a user gesture on that page. A remote command is not a gesture. Two options:
  1. A one-time **"Start display"** overlay on the screen. Tapping it unlocks audio for the session, and presence reports `audioUnlocked: true`. Until then the admin sees *"Screen needs one tap to enable sound"*.
  2. Run the kiosk browser with `--autoplay-policy=no-user-gesture-required`.

  We implement option 1 and document option 2.
- **Removed from BigScreen:** EventSource, the heartbeat, and the BroadcastChannel listener.

### `/admin/control`
- The **Testimonials** and **Video** buttons call `PATCH /api/display-settings { mode }`. One invocation per switch is fine: it's rare and it persists the mode.
  - For `video`, the **server resolves the latest uploaded video** (`Video` ordered by `createdAt desc`, take 1), saves it as `videoUrl`, and publishes `mode.changed` with it.
  - If the library is empty, the server returns 409 *"Upload a video first"* and the Video button is disabled with a link to `/admin/videos`.
- **Left / Right / Pause / Play** publish directly to `display:control`, with 0 Vercel calls. The button shows a pressed or sending state until presence confirms the change.
- **Play / Pause labels come from presence,** not local guesses, so every admin tab agrees with the screen.
- The page shows **"Now playing: <video title>"** in video mode and **"Testimonial 4 of 14 · paused"** in testimonials mode, both from presence.

### Admin shell (sidebar "Now showing", navbar status pill)
- The **connection state** comes from the Ably client: `connected`, `disconnected`, `suspended`, `failed`. These map onto the existing StatusPill tones.
- **Screens connected** is the presence member count. "Now showing" reads presence data.
- **Removed from AdminDataProvider:** EventSource, the reconnect loop, the presence poll, and `/api/display-status` loads.

### `/admin/videos`
- After a successful upload, the server publishes `video.created`.
- If a screen is in video mode, the admin sees a toast: *"New video uploaded. Play it on the big screen now?"*. The screen is **not** switched automatically mid-playback (see D-A).

### Server routes
- `broadcastUpdate(type, payload)` keeps its signature but is **reimplemented on Ably REST**, so existing routes keep working. Each route is then moved to the typed `display:content` events above, sending the changed record.
- **Deleted:** `app/api/stream`, `app/api/display-status`, `src/server/display-presence.ts`, and the `pg` LISTEN/NOTIFY code in `src/server/realtime.ts`.
- The command branch of `PATCH /api/display-settings` (`{target, command}`) is removed, because commands no longer go through the server.

---

## 5. Implementation steps

### Phase 1: Foundation
1.1 Add the `ably` dependency. Use `ably/react` (`AblyProvider`, `ChannelProvider`, `useChannel`, `usePresence`, `usePresenceListener`, `useConnectionStateListener`). Load it client-only, so no WebSocket is opened during SSR.
1.2 `src/lib/realtime/protocol.ts`: channel names, message names, data types, and type guards. This is the only place these strings exist.
1.3 `app/api/realtime/token/route.ts`: role-scoped TokenRequest with a 12h TTL, `Cache-Control: no-store`.
1.4 Minimal admin guard: an `ADMIN_ACCESS_KEY` env var, a `/admin/login` page that sets an httpOnly signed cookie, and `middleware.ts` protecting `/admin/*` plus the `admin` token role. Skip only if D4 delivers real auth first.
1.5 `src/server/realtime.ts`: replace the pg code with an Ably REST client (lazy singleton) and `publish(channel, name, data)`. Keep `broadcastUpdate` as a thin shim during migration.

### Phase 2: Display (`BigScreen`)
2.1 `RealtimeProvider role="display"` around BigScreen.
2.2 Subscribe to `display:control` with dedupe, the 10s staleness window, and command handlers.
2.3 Presence: enter on connect, `update` on discrete changes (mode, pause/play, manual nav, video play/pause, audio unlock). Auto-rotation ticks do **not** update presence.
2.4 Video mode: player bound to `mode.changed` / settings, play/pause handlers, `playing`/`pause`/`ended` listeners updating presence, and the "Start display" audio-unlock overlay.
2.5 Subscribe to `display:content` and patch local lists (approved testimonial appears, hidden or deleted disappears, image changes).
2.6 Delete the SSE, heartbeat, and BroadcastChannel code.

### Phase 3: Admin
3.1 `RealtimeProvider role="admin"` in `AdminShell`. `AdminDataProvider` exposes `connection` (Ably state) and `screens` (presence members).
3.2 `ControlPage`: mode PATCH, commands via `channel.publish`, labels and "Now playing" from presence, a disabled state with reason when no screen is connected or no video exists, and the "needs one tap" notice.
3.3 Sidebar "Now showing" and the StatusPill read from presence and connection state.
3.4 Videos page: listen for `video.created` and show the "Play now?" toast.
3.5 Remove the poll and EventSource code and `fetchDisplayStatus`.

### Phase 4: Server cleanup
4.1 `PATCH /api/display-settings`: drop the command branch, resolve the latest video for `mode: 'video'`, return 409 when there are no videos, publish `mode.changed`.
4.2 Certificates, images, and videos routes publish typed `display:content` deltas.
4.3 Delete `app/api/stream`, `app/api/display-status`, `src/server/display-presence.ts`, and the `pg` notify pool.

### Phase 5: Verification
- **No-polling check:** open `/display` and `/admin/control`, idle for 5 minutes with the network panel recording. **Expected: zero requests** after load, apart from Ably's WebSocket frames.
- **Command latency:** Left/Right/Pause on the admin shows up on the screen within about 300ms, and the presence-driven label updates within about 500ms.
- **Truthfulness:** pause from the on-screen controls updates the admin label, and two admin tabs always agree.
- **Reload safety:** reloading `/display` returns to the same mode and video. Reconnecting after Wi-Fi drops of 30s and 3 minutes resyncs without duplicate "next" steps.
- **Video:** the Video button plays the newest upload, Play/Pause work after the audio unlock, and the 409 path works with an empty library.
- **Security:** a `display` token can't publish (expect a 40160 capability error), and the `admin` token route rejects requests without the admin cookie.
- **Cost:** check the Ably dashboard message count after a 10-minute simulated session (§6 estimate) and count Vercel function invocations in `next dev` logs.

---

## 6. Usage estimate (one 10-hour event: 2 screens, 2 admin tabs)

| Item | Count |
|---|---|
| Vercel: page loads + initial fetches | ~20 |
| Vercel: Ably token issuance (12h TTL) | ~4 |
| Vercel: admin saves (mode switches, approvals, uploads) | as used, typically < 200 |
| **Vercel recurring traffic** | **0** (today: ~14,400 polls/heartbeats + long-lived SSE functions) |
| Ably: commands (each = 1 publish + 1 delivery per subscriber, ~4 subscribers) | 500 presses → ~2,500 messages |
| Ably: presence updates (discrete changes only) | ~1,000 → ~3,000 messages |
| Ably: content deltas | ~200 → ~1,000 messages |
| **Ably total** | **~6,500 messages / event day.** Free-tier limits at the time of writing are about 6M messages/month and 200 concurrent connections; check current Ably pricing |

---

## 7. Decisions needed

| # | Question | Recommendation |
|---|---|---|
| **D-A** | When a new video is uploaded while the screen is in video mode, should it switch automatically? | **No.** Show the admin a "Play it now?" toast instead; switching mid-playback surprises the audience. |
| **D-B** | Should the Videos page keep "Use on big screen" for a specific, older video? | **Yes.** **Video** on Control = latest upload (your request); the Videos page row action = play this specific one. Both use the same `mode.changed` message. |
| **D-C** | Audio unlock: "Start display" tap overlay, or kiosk browser flag? | **Overlay** (works everywhere), plus document the flag for the event laptop. |
| **D-D** | Admin protection before go-live: minimal passcode (step 1.4) or full auth (D4)? | **Minimal passcode now.** Without it, anyone who finds `/admin` can control the screen. |
| **D-E** | Keep `ABLY_SUBCRIBE_KEY`? | **Remove it.** Token auth covers both roles; fewer secrets to manage. |

---

## 8. Files

| File | Change |
|---|---|
| `package.json` | + `ably` |
| `src/lib/realtime/protocol.ts` | **new**: channels, message names, types, guards |
| `src/lib/realtime/RealtimeProvider.tsx` | **new**: client-only Ably provider (`role` prop, `authUrl`) |
| `app/api/realtime/token/route.ts` | **new**: role-scoped TokenRequest |
| `middleware.ts`, `app/admin/login/page.tsx` | **new** (if D-D = passcode) |
| `src/server/realtime.ts` | pg LISTEN/NOTIFY → Ably REST `publish()` |
| `src/components/BigScreen.tsx` | Ably subscribe/presence, video player + audio unlock; remove SSE/heartbeat/BroadcastChannel |
| `src/components/admin/AdminDataProvider.tsx` | Ably connection + presence; remove EventSource/poll |
| `src/components/admin/ControlPage.tsx` | direct publish; presence-driven labels and "Now playing" |
| `src/components/admin/AdminSidebar.tsx`, `StatusPill.tsx` | read Ably connection + presence |
| `src/components/admin/VideosPage.tsx` | `video.created` toast |
| `app/api/display-settings/route.ts` | latest-video resolution, 409, publish `mode.changed`; drop command branch |
| `app/api/{certificates,images,videos}/**` | typed `display:content` deltas |
| `app/api/stream/`, `app/api/display-status/`, `src/server/display-presence.ts` | **delete** |
| `src/lib/api.ts` | remove `sendDisplayCommand`, `fetchDisplayStatus` |
