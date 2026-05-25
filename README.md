# ReadRoot

ReadRoot is a small no-backend reading habit web app.

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
- Optional Supabase login, cloud sync, private groups, and group-only leaderboards.
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

All user data is stored in the browser with `localStorage`.

## Optional Supabase setup

ReadRoot works without a backend. To enable login, cloud sync, private reading groups, and the Reading League:

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase-schema.sql`.
3. Copy your project URL and anon public key into `supabase-config.js`.
4. In Supabase Auth settings, add your deployed site URL to the redirect URLs.

For local preview, add:

```text
http://127.0.0.1:4173
```

The anon key is safe to use in the browser when Row Level Security is enabled.

Group flow:

- Create a private group to get an invite code.
- Share the code with friends.
- Friends join by code after signing in.
- Leaderboards show only members of the selected group.
