# Us Space — starter application

A warm, responsive Next.js prototype for a private couples' co-presence space. It includes the visual dashboard, dual local clocks/weather, countdown, pulse events, realtime cursor broadcasts, movie lounge UI, reaction events, a local tic-tac-toe game, notes vault, and bucket list.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.local.example` to `.env.local`.
3. Run `npm install`, then `npm run dev`.
4. Open http://localhost:3000.

The UI works in **demo mode** without Supabase. To enable cross-device realtime events, create a Supabase project and set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ROOM_ID` (both partners must use the same value)
- `NEXT_PUBLIC_USER_NAME`
- `NEXT_PUBLIC_PARTNER_NAME`

Then restart the dev server and open the site in two browsers/devices using the same room ID. The starter uses a Supabase Realtime channel for presence and broadcasts. It is a prototype, not a secure production couples app.

## What is implemented vs. what still needs engineering

**Prototype included**
- Responsive, warm dashboard and day/night styling
- Live clocks and weather from Open-Meteo for sample cities
- Reunion countdown
- Pulse broadcast, visual ripple, floating hearts, mobile vibration when supported
- Broadcast-based remote cursor
- Movie lounge controls and reaction broadcasts
- Tic-tac-toe UI, doodle canvas, notes vault, bucket list
- Responsive navigation between modules

**Not production-complete**
- Authentication, account pairing, invite links, room membership enforcement and database-backed persistence
- True synchronized playback. Current broadcast sends playback intent/time but does not control a partner's media element with clock drift correction. YouTube requires the IFrame Player API; browser autoplay restrictions apply.
- WebRTC camera/microphone. The circular video bubbles are UI placeholders. Add Daily, Agora or a WebRTC signaling/ICE implementation and explicit camera/mic permission UX.
- Secure question reveal and time-locked notes. These must be enforced server-side with row-level security and server time, not client-only state.
- Persistent multiplayer game state, shared canvas strokes, actual TMDB discovery/matchmaking, media uploads, geotags, drag-and-drop itinerary, push notifications and PWA service worker.
- Production rate limiting, validation, monitoring and abuse protections.

## Security checklist before inviting anyone

1. Implement Supabase Auth and require exactly two authorized users per room.
2. Add Postgres tables for rooms, memberships, bucket-list items, envelopes, questions, answers, milestones, games and movie likes.
3. Enable RLS on every table. Never put a Supabase service-role key in browser code.
4. Use a server/Edge Function to unlock timed envelopes and reveal daily answers only after both participants submit.
5. Validate all broadcasts and database writes against authenticated room membership.
6. Add privacy controls and explicit consent before camera/microphone access.

## Recommended next steps

Build this as staged milestones: (1) Auth + private pairing + database/RLS, (2) reliable synced video + WebRTC, (3) persistent games and vault, (4) TMDB, uploads, itinerary and PWA notifications. This keeps security and synchronization from becoming fragile as features grow.
