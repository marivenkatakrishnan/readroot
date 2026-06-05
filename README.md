# ReadRoot

ReadRoot is a small local-first reading habit web app.

## MVP features

- Search books through the Open Library API.
- Browse curated categories through Open Library subject feeds.
- Add books to Want, Reading, or Finished shelves.
- Track current page and total pages.
- Log pages read.
- Log reading sessions with exact date/time and optional minutes.
- Review recent reading history and today/7-day/all-time summaries.
- Track a weekly page goal.
- View a 35-day reading calendar.
- See pace stats and finish date predictions.
- Follow friendly monthly and weekly reading challenges.
- Browse mood-based book suggestions.
- Mark daily reading streaks.
- Use a 10, 20, or 30 minute reading timer.
- Save multiple typed journal notes per book.
- Optional Supabase login, reading-data sync, private groups, and group-only leaderboards.
- Save year goal locally.

## Run locally

Open `index.html` directly, or run:

```sh
python3 -m http.server 4173
```

Then visit:

```text
http://127.0.0.1:4173
```

Without Supabase keys, all user data is stored in the browser with `localStorage`.

## Optional Supabase setup

ReadRoot works without Supabase. For Phase 2, keep Cloudflare Pages as the frontend host and use Supabase only for accounts, reading-data sync, private groups, and group leaderboards.

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase-schema.sql`.
3. In Supabase, open Project Settings -> API.
4. Copy the Project URL and anon public key into `supabase-config.js`.
5. In Supabase Auth URL settings, set the site URL to your Cloudflare Pages URL, for example `https://readroot.pages.dev`.
6. Add redirect URLs for every place you will test or deploy the app. If magic links open `localhost:3000`, the Supabase Site URL is still pointing at a local default and must be changed.
7. Commit and redeploy the same static files to Cloudflare Pages.

For local preview, add:

```text
http://127.0.0.1:4173
```

For Cloudflare Pages, add:

```text
https://readroot.pages.dev
https://readroot.pages.dev/**
```

If you later use a custom domain, also add it:

```text
https://app.readroot.in
```

Use only the anon public key in `supabase-config.js`. Never use the `service_role` key in a frontend file. The anon key is safe for browser use because the schema enables Row Level Security.

Email magic link is the default sign-in method. The Google button stays hidden unless `googleEnabled: true` is set in `supabase-config.js` after Google OAuth is enabled in Supabase Auth providers.

If the app shows `Email rate limit exceeded`, the hosted Supabase test email sender has reached its limit. Wait for the limit to reset, or configure Custom SMTP in Supabase Authentication settings before inviting more testers. Profile and group controls appear only after a successful sign-in.

Cloud sync scope:

- A private `reading_snapshots` row stores shelves, notes, goals, reading logs, marked days, and book progress for each signed-in user.
- `reading_logs` stores session rows used by private group leaderboards.
- Profiles default to private; the app shows leaderboards only inside groups the signed-in user belongs to.

Group flow:

- Create a private group to get an invite code.
- Share the code with friends.
- Friends join by code after signing in.
- Leaderboards show only members of the selected group.
