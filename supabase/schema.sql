create extension if not exists pgcrypto;

create table if not exists public.research_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('article', 'book', 'quote', 'video', 'framework', 'note', 'other')),
  source_link text,
  raw_content text not null,
  teacher_response text,
  summary_short text,
  summary_bullets jsonb not null default '[]'::jsonb,
  key_ideas jsonb not null default '[]'::jsonb,
  teaching_implications jsonb not null default '[]'::jsonb,
  suggested_tags jsonb not null default '[]'::jsonb,
  reflective_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_idea text not null,
  subject text,
  level text,
  context text,
  status text not null default 'spark' check (status in ('spark', 'developing', 'ready_to_try', 'tried', 'refined', 'archived')),
  summary_short text,
  suggested_tags jsonb not null default '[]'::jsonb,
  ai_expanded_activity text,
  student_instructions text,
  teacher_facilitation_notes jsonb not null default '[]'::jsonb,
  possible_assessment_evidence jsonb not null default '[]'::jsonb,
  philosophy_connections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reflection_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  reflection_date date not null default current_date,
  class_context text,
  raw_reflection text not null,
  summary_short text,
  key_insight text,
  themes jsonb not null default '[]'::jsonb,
  tensions jsonb not null default '[]'::jsonb,
  possible_next_actions jsonb not null default '[]'::jsonb,
  possible_beliefs jsonb not null default '[]'::jsonb,
  unresolved_questions jsonb not null default '[]'::jsonb,
  linked_lesson_idea_id uuid references public.lesson_ideas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.belief_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme text not null,
  belief_statement text not null,
  teacher_edited_text text,
  status text not null default 'suggested' check (status in ('suggested', 'approved', 'rejected', 'unresolved', 'archived')),
  source_type text not null check (source_type in ('research', 'reflection', 'lesson_idea', 'manual')),
  source_id uuid,
  evidence text,
  unresolved_question text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.philosophy_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  generated_from_belief_ids jsonb not null default '[]'::jsonb,
  teacher_notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.research_entries enable row level security;
alter table public.lesson_ideas enable row level security;
alter table public.reflection_entries enable row level security;
alter table public.belief_cards enable row level security;
alter table public.philosophy_documents enable row level security;
alter table public.tags enable row level security;

drop policy if exists research_entries_owner on public.research_entries;
create policy research_entries_owner on public.research_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists lesson_ideas_owner on public.lesson_ideas;
create policy lesson_ideas_owner on public.lesson_ideas
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists reflection_entries_owner on public.reflection_entries;
create policy reflection_entries_owner on public.reflection_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists belief_cards_owner on public.belief_cards;
create policy belief_cards_owner on public.belief_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists philosophy_documents_owner on public.philosophy_documents;
create policy philosophy_documents_owner on public.philosophy_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists tags_owner on public.tags;
create policy tags_owner on public.tags
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
