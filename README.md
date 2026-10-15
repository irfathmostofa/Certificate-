# Certify Studio

A fully dynamic certificate generation system built with **React + Vite** and a **Supabase** backend.
Admins can pick from professional certificate templates, customize their design, and generate
**single or bulk** certificates with logos, watermarks and a custom signature image.

## Features

- **Professional templates** — 7 built-in designs with ornate borders, guilloché seal /
  monogram / text watermarks, accent strips and high-quality typography (Cinzel, Playfair
  Display, Great Vibes, Cormorant, Inter).
- **Live design editor** — change composition, border style, colors, fonts, watermark and
  opacity with an instant preview. Save your own custom templates.
- **Single generation** — fill in one recipient, preview, then export or save.
- **Bulk generation** — upload a CSV (or add recipients manually) and generate an entire cohort
  at once, then download everything as one combined PDF.
- **Custom signature & logo** — upload a signature image (and logo) in Organization settings;
  a typed script signature is used as a fallback.
- **Exports** — high-resolution **PDF**, **PNG** and **JPEG** generated in the browser.
- **Certificate library** — search, preview, re-export and delete issued certificates.
- **Public verification** — every issued certificate gets an unguessable share link
  (`/view/<token>`) that anyone can open, no login required, to view and verify it.
- **Demo mode** — runs entirely in the browser (localStorage) when Supabase is not configured,
  so you can preview the whole UI immediately.

## Tech stack

| Concern      | Choice                                    |
| ------------ | ----------------------------------------- |
| UI           | React 18 + React Router                   |
| Build tool   | Vite 5                                    |
| Backend      | Supabase (Postgres + Auth + Storage)      |
| Export       | html2canvas + jsPDF                       |
| CSV parsing  | PapaParse                                 |

## Getting started

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open the printed URL. In demo mode use the pre-filled login (any email and a password of at
least 4 characters) to explore the app.

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy the project URL and anon key.
3. Create a `.env` file in the project root (see `.env.example`):

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Run the SQL in `supabase/schema.sql` via **SQL Editor → New query**. It creates the
   `settings`, `templates` and `certificates` tables, row-level security policies, and the
   `certify-assets` storage bucket for logos and signatures.
5. Create an admin user in **Authentication → Users** and sign in with it.

> The anon key is safe to expose in the frontend. All tables are protected by row-level
> security and require an authenticated user.

## Data model

- `settings` — single row (`id = 1`) holding organization info, signature and default design.
- `templates` — custom templates created in the app (built-in presets ship with the code).
- `certificates` — every issued certificate, with an optional per-certificate design override.

## Project structure

```
src/
  components/
    certificate/        # certificate renderer, SVG decorations, badge seal, preview scaler
    DesignEditor.jsx    # live design customization panel
    Layout.jsx          # app shell (sidebar + topbar)
    ui.jsx, icons.jsx   # shared UI primitives
  context/              # AuthContext, DataContext
  lib/                  # supabase client, data layer, templates, export helpers
  pages/                # Login, Dashboard, Templates, Generate, BulkGenerate, Certificates, Settings
  styles/global.css     # admin UI theme
supabase/schema.sql     # database schema + policies
```

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # eslint
```
