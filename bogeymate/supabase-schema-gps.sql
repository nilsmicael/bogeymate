-- ─────────────────────────────────────────────
--  supabase-schema-gps.sql
--  Lägg till dessa tabeller i Supabase SQL Editor
--  EFTER att du kört supabase-schema.sql
-- ─────────────────────────────────────────────

-- ─── courses ──────────────────────────────────
-- En kurs kan användas av alla rundor på den banan.
create table public.courses (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  location     text,
  holes_count  int not null default 18,
  osm_fetched  boolean default false,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now()
);

-- ─── course_holes ─────────────────────────────
-- GPS-koordinater per hål. Alla punkttyper är valfria.
-- Mitten av green (green_lat/lon) är den viktigaste.
create table public.course_holes (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),

  -- Mitten av green (obligatorisk för avståndsmätning)
  green_lat   double precision,
  green_lon   double precision,

  -- Framkant och bakkant green (valfritt)
  front_lat   double precision,
  front_lon   double precision,
  back_lat    double precision,
  back_lon    double precision,

  -- Tee (valfritt)
  tee_lat     double precision,
  tee_lon     double precision,

  -- Varifrån kom datan
  source      text default 'manual' check (source in ('manual','osm')),
  updated_at  timestamptz default now(),

  unique (course_id, hole_number)
);

-- ─── Koppla rounds till courses ────────────────
-- Lägg till course_id i befintlig rounds-tabell
alter table public.rounds add column if not exists course_id uuid references public.courses(id);

-- ─── Indexes ──────────────────────────────────
create index on public.courses (name);
create index on public.course_holes (course_id, hole_number);

-- ─── Row Level Security ───────────────────────
alter table public.courses      enable row level security;
alter table public.course_holes enable row level security;

-- Alla kan läsa bandata (det är publik info)
create policy "Läs banor"
  on public.courses for select using (true);
create policy "Skapa bana"
  on public.courses for insert with check (auth.uid() is not null);
create policy "Uppdatera bana"
  on public.courses for update using (created_by = auth.uid());

create policy "Läs håldata"
  on public.course_holes for select using (true);
create policy "Spara håldata"
  on public.course_holes for insert with check (auth.uid() is not null);
create policy "Uppdatera håldata"
  on public.course_holes for update using (auth.uid() is not null);
