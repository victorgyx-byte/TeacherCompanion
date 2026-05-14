# Teacher Companion

Teacher Companion is an MVP reflective thinking companion for teachers. It keeps the teacher as author while AI helps summarise, organise, question, and draft.

Guiding architecture principle:

> Capture everything, summarise once, retrieve selectively, synthesise only when needed.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add keys when you want live AI or Supabase:

```bash
OPENAI_API_KEY=
OPENAI_SUMMARY_MODEL=
OPENAI_REASONING_MODEL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Without an OpenAI key, the app still saves raw entries and uses local short summaries for research notes.

## Cost-control design

- Raw archive fields keep full teacher inputs for review and retrieval.
- Summary fields are generated once and stored so later AI calls do not reread raw archives.
- `buildCompactContextPack()` in `lib/retrieval.ts` retrieves only a small number of approved beliefs and summaries.
- Lesson expansion and reflection analysis send compact context packs, not the full user library.
- Philosophy drafts use approved belief cards only, plus explicitly selected unresolved questions.
- AI calls are server-side in `app/api/ai/*`.
- Model names are configurable through environment variables.

## Database

The Supabase starter schema is in `supabase/schema.sql`.

Phase 2 notes:
- The app uses Supabase Auth email sign-in links.
- Data is stored per authenticated user with RLS policies using `auth.uid() = user_id`.
- In Supabase SQL Editor, run the full `supabase/schema.sql` script once before using the app.
