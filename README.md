# Onesys

Onesys is a responsive music-team workspace for preparing services. It helps leaders plan a service, choose the lineup, build the setlist, and notify team members.

## Run Locally

From the project folder:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173/`.

Create a root `.env.local` file from `.env.example` and add the Supabase project URL and public publishable key. Never put a Supabase `service_role` key in this React app.

## Supabase Setup

The database schema is in `supabase/schema.sql`. If it has already run successfully, do not run it again. Run only migrations that have not been applied.

Migration files:

1. `schema.sql` creates the core tables and RLS foundation.
2. `grant-authenticated-access.sql` grants required table privileges.
3. `make-admin.sql` assigns the owner account as Admin. Check the email before running it.
4. `services-workflow.sql` adds standard music roles and assignment permissions.
5. `leader-access.sql` gives Music Directors the same leader access as Admins.
6. `archive-workflow.sql` adds archive fields and permissions.
7. `music-links.sql` adds service playlist links and song source links.
8. `seed-music-roles.sql` adds standard roles if they are missing.
9. `song-charts.sql` adds Music Leader access and structured song chart fields.
10. `chordpro-source.sql` adds the authoritative ChordPro source for each chart.
11. `song-library-duplicates.sql` finds existing duplicate songs before optional database-level protection.
12. `import-song` is a deployed Edge Function for approved-domain song URL previews.
13. `hardening.sql` aligns service/song writes and archive access with leader roles and adds atomic setlist appends. Run it after all previous migrations.
	Music Leader is a lineup role, not an account type. The migration removes legacy Music Leader account assignments. A member assigned that role can edit the song library only after confirming the assignment and marking availability for that service date.
14. `music-leader-access.sql` applies the Music Leader access change separately when `hardening.sql` was already run.

Run SQL files in the Supabase SQL Editor. A successful migration normally reports `Success. No rows returned`.

## Roles

Admin and Music Director have the same operational access:

- Create and manage services
- Build and edit lineups
- Build and edit setlists
- Archive and unarchive services and setlists
- Remove lineup members or setlist songs after confirmation
- Manage account types
- View Archives

Regular music members can:

- View the Dashboard and Calendar
- Open a calendar event to see Topic, Description, Lineup, and Setlist
- Manage their own availability
- Respond to assignments from the notification bell
- View Songs and source links

Regular members cannot create services, edit lineups, edit setlists, access Admin, or access Archives.

## Service Workflow

Leaders complete a service in one guided flow:

1. **Service details:** topic, date, time, description, and optional playlist link.
2. **Team lineup:** choose members and the music role they will play.
3. **Setlist:** add songs from the library and remove them when necessary.

Setlists are managed inside a Service. There is no separate Setlist navigation page.

## Notifications

Assignments and conflicts appear in the notification bell. A red dot means there are unread pending assignments or conflicts. Members can Confirm or Decline assignments there.

## Songs And Playlist Import

Songs are stored in the `songs` table with title, artist, lyrics, chords, and an optional source URL.

The Songs page supports manual songs, source links, playlist review, and editable song charts. Each chart can have named sections, lyrics, chords, an original key, transposed display keys, or Nashville numbers. Playlist import does not add records immediately: it detects songs, opens a selection modal, and saves only the songs the leader checks.

The playlist importer is `supabase/functions/import-playlist/index.ts`. YouTube playlist import is active and requires a deployed Supabase Edge Function plus the server-side `YOUTUBE_API_KEY` secret. The Spotify path is temporarily disabled while its integration is being repaired.

Song URL import is handled by `supabase/functions/import-song/index.ts`. The first deterministic parser allows HTTPS pages from Ultimate Guitar, AZLyrics, and Lyrics.com. It fetches server-side with a timeout and response-size limit, returns an editable preview, and does not save anything until the user confirms. Unsupported domains are rejected.

Deploy the function before using **Import Song**:

```powershell
supabase functions deploy import-song
```

Never put those secrets in `.env.local` or frontend code.

## Authentication

Supported authentication:

- Email and password
- Forgot password through Supabase email
- Google OAuth

Facebook OAuth is intentionally not enabled. Configure the Google callback URL in Google Cloud and Supabase before testing Google login.

## Project Structure

- `src/App.tsx` contains authentication, navigation, dashboard, and notification state.
- `src/components/ServicesView.tsx` contains the leader service workflow.
- `src/components/PlanningViews.tsx` contains Calendar and Availability.
- `src/components/MusicViews.tsx` contains Songs.
- `src/components/AccountViews.tsx` contains Profile, Members, Admin, and account workflows.
- `src/components/PlaylistImportModal.tsx` contains playlist review and selection.
- `src/lib/supabase.ts` creates the Supabase client.
- `supabase/` contains schema, migrations, and Edge Functions.

## Validation

```powershell
npm.cmd run build
npm.cmd run lint
```

The interface is designed for desktop, tablet, iPad, Android, and iPhone. Phones use a hamburger drawer, stacked content, full-width controls, and no horizontal page scrolling.
