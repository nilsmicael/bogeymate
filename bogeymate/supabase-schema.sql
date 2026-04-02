-- ─────────────────────────────────────────────
--  BogeyMate — Supabase databas-schema
--  Kör detta i Supabase SQL Editor
-- ─────────────────────────────────────────────

-- Aktivera UUID-extension
create extension if not exists "uuid-ossp";

-- ─── profiles ─────────────────────────────────
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  handicap          numeric(4,1) default 18.0,
  notify_new_round  boolean default true,
  notify_scores     boolean default true,
  notify_finished   boolean default false,
  notify_invites    boolean default true,
  public_rounds     boolean default true,
  public_profile    boolean default true,
  created_at        timestamptz default now()
);

-- ─── rounds ───────────────────────────────────
create table public.rounds (
  id          uuid primary key default uuid_generate_v4(),
  course_name text not null,
  holes       int not null default 18 check (holes in (9, 12, 13, 14, 15, 16, 17, 18)),
  format      text not null default 'stableford'
              check (format in ('slagspel','stableford','matchspel','fourball','foursome','scramble','bestball')),
  start_hole  int not null default 1 check (start_hole between 1 and 18),
  is_shotgun  boolean default false,
  host_id     uuid references public.profiles(id),
  status      text not null default 'active' check (status in ('active','finished')),
  created_at  timestamptz default now(),
  finished_at timestamptz
);

-- ─── round_players ────────────────────────────
create table public.round_players (
  id        uuid primary key default uuid_generate_v4(),
  round_id  uuid not null references public.rounds(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  handicap  numeric(4,1) not null,
  joined_at timestamptz default now(),
  unique (round_id, user_id)
);

-- ─── scores ───────────────────────────────────
create table public.scores (
  id                uuid primary key default uuid_generate_v4(),
  round_id          uuid not null references public.rounds(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  hole_number       int not null check (hole_number between 1 and 18),
  strokes           int check (strokes between 1 and 20),
  picked_up         boolean default false,
  par               int not null check (par between 3 and 5),
  handicap_strokes  int not null default 0 check (handicap_strokes between 0 and 2),
  netto_strokes     int,
  stableford_points int not null default 0,
  vs_par_brutto     int,
  updated_at        timestamptz default now(),
  unique (round_id, user_id, hole_number)
);

-- ─── reactions ────────────────────────────────
create table public.reactions (
  id          uuid primary key default uuid_generate_v4(),
  round_id    uuid not null references public.rounds(id) on delete cascade,
  hole_number int not null,
  user_id     uuid references public.profiles(id),
  emoji       text not null check (emoji in ('👏','🔥','😬','🎉')),
  created_at  timestamptz default now(),
  unique (round_id, hole_number, user_id, emoji)
);

-- ─── invites ──────────────────────────────────
create table public.invites (
  id          uuid primary key default uuid_generate_v4(),
  round_id    uuid not null references public.rounds(id) on delete cascade,
  invited_by  uuid references public.profiles(id),
  code        text not null unique,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

-- ─── Indexes ──────────────────────────────────
create index on public.rounds (status, created_at desc);
create index on public.round_players (round_id);
create index on public.round_players (user_id);
create index on public.scores (round_id, user_id);
create index on public.scores (round_id, updated_at desc);
create index on public.reactions (round_id);
create index on public.invites (code);

-- ─── Row Level Security ───────────────────────
alter table public.profiles     enable row level security;
alter table public.rounds        enable row level security;
alter table public.round_players enable row level security;
alter table public.scores        enable row level security;
alter table public.reactions     enable row level security;
alter table public.invites       enable row level security;

-- Profiles: alla kan läsa publika, bara du kan uppdatera din
create policy "Publik läsning av profiler"
  on public.profiles for select using (public_profile = true or id = auth.uid());
create policy "Uppdatera din egen profil"
  on public.profiles for update using (id = auth.uid());

-- Rounds: alla kan se aktiva rundor om värden är publik
create policy "Läs aktiva rundor"
  on public.rounds for select using (
    status = 'active' or host_id = auth.uid()
  );
create policy "Skapa runda"
  on public.rounds for insert with check (host_id = auth.uid());
create policy "Uppdatera din runda"
  on public.rounds for update using (host_id = auth.uid());

-- Round players: alla kan se, bara du lägger till dig själv
create policy "Läs spelare"
  on public.round_players for select using (true);
create policy "Gå med i runda"
  on public.round_players for insert with check (user_id = auth.uid());

-- Scores: alla i rundan kan läsa, bara du skriver dina slag
create policy "Läs slag"
  on public.scores for select using (true);
create policy "Spara dina slag"
  on public.scores for insert with check (user_id = auth.uid());
create policy "Uppdatera dina slag"
  on public.scores for update using (user_id = auth.uid());

-- Reactions: alla kan läsa, inloggade kan lägga till
create policy "Läs reaktioner"
  on public.reactions for select using (true);
create policy "Lägg till reaktion"
  on public.reactions for insert with check (auth.uid() is not null);

-- Invites: bara du kan skapa, alla kan läsa sin kod
create policy "Skapa inbjudan"
  on public.invites for insert with check (invited_by = auth.uid());
create policy "Läs inbjudan"
  on public.invites for select using (true);

-- ─── Realtime ─────────────────────────────────
-- Aktivera realtidsuppdateringar för scores och reactions
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.reactions;
