# Tempo

Tempo is a React, TypeScript, and Vite study timer. It works in Guest Mode and
uses Supabase authentication for optional cross-device synchronization.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from your Supabase project.
3. Add your local and deployed app URLs to **Authentication → URL Configuration**
   in the Supabase dashboard. Set the site URL to your production origin.
4. Apply every SQL migration in `supabase/migrations` to your Supabase project.
5. Run `npm run dev`.

The Supabase anon/publishable key is intended for browser use. Never expose a
service-role key in a `VITE_` variable.

## Deploy to GitHub Pages

1. Push this repository to GitHub with the default branch named `main`.
2. In **Settings → Pages**, choose **GitHub Actions** as the build and
   deployment source.
3. Add these repository Actions variables under **Settings → Secrets and
   variables → Actions → Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_VAPID_PUBLIC_KEY` (optional; required for Web Push)
4. Push to `main` or run **Deploy Tempo PWA to GitHub Pages** from the Actions
   tab. The workflow builds with the `/Timer-PWA/` base path, creates the SPA
   fallback page, and deploys the installable PWA.
5. Add the deployed URL, including `/Timer-PWA/`, to the Supabase Auth site URL
   and redirect URL allow list. Apply every migration in
   `supabase/migrations`.

The application manifest and PNG/SVG icons are in `public/`. The service worker
caches the app shell and static assets, serves cached content while offline,
handles incoming Web Push events, and requests workspace sync through the
Background Sync API where supported. Background Sync asks available app clients
to process queued work; browsers without that API synchronize on the regular
online event. Mobile portrait mode recommends rotating the device; users can
dismiss the recommendation for the current tab.

To test the production service worker locally, run `npm run build` followed by
`npm run preview`; the development server does not register the worker.

## Configure Web Push s

Push delivery requires VAPID keys and the Supabase Edge Function; browser
notifications alone do not provide server-to-device delivery.

1. Generate a VAPID key pair with `npx web-push generate-vapid-keys`.
2. Set the public key as the GitHub Actions variable
   `VITE_VAPID_PUBLIC_KEY` and local `VITE_VAPID_PUBLIC_KEY`.
3. Set the private values as Supabase function secrets; never put the private
   key in a `VITE_` variable:

   ```sh
   supabase secrets set VAPID_PUBLIC_KEY=<public-key> \
     VAPID_PRIVATE_KEY=<private-key> \
     VAPID_SUBJECT=mailto:admin@example.com
   supabase functions deploy send-push
   ```

4. Apply `202611020004_push_subscriptions.sql`, sign in to the deployed PWA, and
   enable notifications in **Settings**.

The timer sends **Task complete** and **Break complete** push events for
completed sessions. Browser permission and an active push subscription are
required on receiving devices.

## Enable sign-in providers

- In **Authentication → Providers**, enable Email and choose whether email
  confirmation is required.
- Enable Google and configure its OAuth client credentials. Add the Supabase
  callback URL shown by the provider settings to the Google OAuth client.
- Add each local and production app origin to the Supabase redirect URL allow
  list. OAuth returns to the app origin; password recovery returns to
  `/reset-password`.

## Authentication routes

- `/login` — email/password and Google OAuth
- `/register` — account registration with optional email confirmation
- `/forgot-password` — sends a password recovery email
- `/reset-password` — completes a valid password recovery session

Protected application routes send unauthenticated users to `/login` and return
them to their originally requested route after successful sign-in.

## Task management

The dashboard includes task sheets and searchable task lists. Sheets and tasks
are persisted locally in Dexie and Zustand. Starting a task from its play
control starts the focus timer at the task's estimate and tracks actual
minutes from timer sessions. Active and completed tasks share a single list;
completed tasks are sorted last and remain searchable and filterable. Actual
time is read-only and manual completion has no actual-time value.
On upgrade, legacy actual totals for incomplete and manually completed tasks are
cleared because their source cannot be verified; saved timer sessions remain in
session history, and completed timer-tracked totals are preserved.
The task-row check action asks for confirmation, then marks the task complete
without starting a timer or creating a focus session. Completion source is
stored as `manual` or `timer`; timer completions continue to record the actual
session duration, while manual completion sets actual time to null and does
not add focus time. Apply
`202611020006_task_completion_method.sql` after the core schema migration to
store this field in the normalized task table. Apply
`202611020007_task_paused_status.sql` to add the paused status to the normalized
schema and enforce a single in-progress task per user. Apply
`202611020008_overtime_and_manual_task_time.sql` to support overtime sessions
and null actual time for manual completions.

Each task row offers Complete, Pause, and Start/Resume actions before the task
title. Pause retains
the current timer snapshot and elapsed time. Starting another task prompts for
confirmation; Pause & Start saves the current session and its elapsed time,
marks that task Paused, then starts the selected task.

The Pomodoro timer stores its active timestamp-based session in IndexedDB and
the user's `pomodoro_timer_state` row in Supabase. Finished and stopped session
progress is also recorded in IndexedDB and `pomodoro_timer_sessions`. The
Supabase migration enables row-level security so a user can only access their
own timer records.

When a timer reaches zero, answering No enters overtime and continues tracking
time in amber. Timer sessions record estimated, actual, and overtime duration.
The timer includes an animated hours/minutes/seconds clock, synthesized alarm
tones with saved sound and volume preferences, fullscreen mode, time extensions,
early completion, and timed breaks. Alarm playback requires a browser that
supports the Web Audio API; browsers may require a user gesture before audio
can play. The optional next-task autoplay preference starts the next pending
task in the completed task's sheet after a 10-second prompt.

The desktop sidebar is a hover-expandable icon rail with a compact Dynamic
Island timer. Light, Dark, and OLED themes are available. While a timer runs,
the app requests the Screen Wake Lock API when supported. Use Shift+F for Focus
Mode or `?` to view keyboard shortcuts. The application version is shown in the
footer and Settings > About; GitHub Actions uses the package version or a
semantic-version release tag.

## Analytics and session history

- `/analytics` shows today's and this week's focus time, tasks completed today,
  average focus-session duration, estimation accuracy, break time, and focus,
  completion, and focus-versus-break charts.
- Estimation accuracy is calculated as the average `estimate / actual` ratio
  for completed tasks with a non-zero actual duration.
- `/history` lists focus and break sessions, with date, sheet, and task filters.
  Session notes are saved to IndexedDB and Supabase.
- Analytics and history combine the signed-in user's Supabase sessions with
  locally persisted session records. Task completion and estimation metrics
  use the task sheets stored in this browser.

Apply `202611020002_timer_session_notes.sql` after the original timer migration
to enable remote session notes. The application reports a sync warning when
either local or remote history is unavailable.

## Offline-first workspace

Task sheets and tasks are cached in Dexie and changes are coalesced into a
per-user workspace sync queue. Task creation, edits, deletion, completion, and
starting a timer remain available offline. Timer snapshots and all locally
recorded sessions are retried to Supabase when connectivity returns.

Apply Supabase migrations `202611020001` through `202611020011` in filename
order after configuring Supabase Auth. Migration `202611020003` creates the
RLS-protected workspace table, and `202611020009` installs timestamp-based
synchronization RPCs and removes legacy conflict queue states. Local edits
remain queued offline; when online, the record with the newest `updated_at`
timestamp automatically wins and is applied without a user prompt. The queue
retries automatically when connectivity returns and periodically while the app
is open. Timer state uses the same server-side timestamp comparison and a
single per-user database row, so devices converge on one active timer state.
Migration `202611020010` adds synchronized suspended-focus data so breaks can
pause and later resume the same focus session across devices.
Migration `202611020011` adds the profile preferences field used when guest
settings are copied to an account.

## Guest Mode and account migration

The application can be used without signing in. Guest task workspaces, timer
snapshots, and focus/break sessions are stored locally in IndexedDB; theme and
timer preferences remain in browser storage. Analytics, history, task sheets,
breaks, and timer controls remain available offline.

Signing in with Google or email/password merges guest sheets and tasks with the
account workspace, copies local timer sessions, carries over the current timer
state when it is the newest state, and merges preferences into the account
profile. Guest records are retained locally until migration succeeds. Apply
`202611020011_guest_settings.sql` after the earlier migrations before enabling
account migration in a deployed Supabase project.

The GitHub Pages workflow injects the `package.json` version into the build.
Service-worker updates notify users when a new deployment is available; the
update action activates the new worker, invalidates the previous app-shell
cache, and reloads the application.

## FocusFlow relational database schema

The normalized FocusFlow schema is provided as
`supabase/migrations/202611020005_focusflow_core_schema.sql`. Apply migrations
in filename order after configuring Supabase Auth. This migration adds
`profiles`, `sheets`, `tasks`, `focus_sessions`, `break_sessions`, `statistics`,
and `sync_queue`, with UUID keys, ownership-aware foreign keys, indexes,
soft-delete timestamps, audit columns, and per-user row-level security.
Browser roles use soft-delete updates rather than hard-delete privileges; a
partial unique index also prevents more than one running focus session per
user. Task/session statuses are stored as lowercase values such as
`in_progress`.

The migration creates or backfills a profile when an Auth user is created.
Task and session writes maintain daily UTC aggregates in `statistics`; clients
can read those aggregates but cannot write them directly. The migration adds
the schema tables to `supabase_realtime` when that publication exists.
`supabase/queries/focusflow_optimized_queries.sql` contains authenticated,
RLS-scoped examples for sheets/tasks, session history, daily analytics, and
pending sync work.

This is an additive normalized schema, not a data conversion. The current app
still stores its task workspace in the `offline_workspaces` JSON document and
timer history in `pomodoro_timer_sessions`; its Dexie sync queue is also
browser-local. Those existing tables and client services are not redirected
to `sheets`, `tasks`, `focus_sessions`, or `sync_queue` by this migration.
Migrate application reads/writes and existing user data separately before
using the normalized tables as the app's active persistence layer. Validate
the migration against a staging Supabase project before production rollout.
