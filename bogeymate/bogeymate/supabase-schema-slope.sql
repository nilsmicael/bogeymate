-- ─────────────────────────────────────────────
--  supabase-schema-slope.sql
--  Lägger till slope, course rating och tee-färger
--  per bana. Kör i Supabase SQL Editor.
-- ─────────────────────────────────────────────

-- Tee-alternativ per bana (gul, röd, vit, blå osv)
create table if not exists public.course_tees (
  id            uuid primary key default uuid_generate_v4(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  tee_color     text not null,   -- 'gul', 'röd', 'vit', 'blå', 'svart'
  tee_label     text not null,   -- Visningsnamn t.ex. "Gul (herr)"
  slope         int  not null default 113,
  course_rating numeric(4,1) not null default 72.0,
  par           int  not null default 72,
  created_at    timestamptz default now()
);

create index if not exists course_tees_course on public.course_tees(course_id);

alter table public.course_tees enable row level security;
create policy "Läs tee-data" on public.course_tees for select using (true);
create policy "Spara tee-data" on public.course_tees for insert with check (auth.uid() is not null);
create policy "Uppdatera tee-data" on public.course_tees for update using (auth.uid() is not null);

-- Lägg till tee_id på rounds så vi vet vilken tee som spelades
alter table public.rounds add column if not exists tee_id uuid references public.course_tees(id);
alter table public.rounds add column if not exists course_id uuid references public.courses(id);

-- Spelande handicap per spelare i rundan (kan justeras manuellt)
alter table public.round_players add column if not exists playing_handicap int;
alter table public.round_players add column if not exists hcp_index numeric(4,1);
