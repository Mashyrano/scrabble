-- Scrabble schema. Run once in the Supabase SQL editor (or `supabase db push`).

-- ------------------------------------------------------------------ live tables

-- The full game, bag and racks included. No policies: only the `room` edge
-- function (service role) can read or write it.
create table public.rooms (
  code text primary key,
  version integer not null,
  game jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.rooms enable row level security;

-- What every player at a table may see.
create table public.room_states (
  code text primary key references public.rooms (code) on delete cascade,
  version integer not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.room_states enable row level security;
create policy "Signed-in users can read tables"
  on public.room_states for select to authenticated using (true);

-- Each player's rack, readable only by that player.
create table public.room_hands (
  code text not null references public.rooms (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seat integer not null,
  version integer not null,
  tiles jsonb not null default '[]',
  primary key (code, user_id)
);
alter table public.room_hands enable row level security;
create policy "Players can read their own rack"
  on public.room_hands for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.room_states, public.room_hands;

-- Saves a game if nobody else saved since `p_version`, and publishes its public
-- state and racks in the same transaction. Returns false on a lost race.
create function public.save_room(p_code text, p_version integer, p_game jsonb, p_state jsonb, p_hands jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_version = 0 then
    insert into public.rooms (code, version, game) values (p_code, 1, p_game)
      on conflict (code) do nothing;
  else
    update public.rooms set game = p_game, version = p_version + 1, updated_at = now()
      where code = p_code and version = p_version;
  end if;
  if not found then
    return false;
  end if;

  insert into public.room_states (code, version, state) values (p_code, p_version + 1, p_state)
    on conflict (code) do update
      set version = excluded.version, state = excluded.state, updated_at = now();

  -- Only touch racks that changed, so players are not sent the same rack again.
  insert into public.room_hands as h (code, user_id, seat, version, tiles)
    select p_code, (x ->> 'user_id')::uuid, (x ->> 'seat')::integer, p_version + 1, coalesce(x -> 'tiles', '[]'::jsonb)
    from jsonb_array_elements(p_hands) as x
    on conflict (code, user_id) do update
      set seat = excluded.seat, version = excluded.version, tiles = excluded.tiles
      where h.tiles is distinct from excluded.tiles;

  return true;
end;
$$;
revoke execute on function public.save_room from public, anon, authenticated;
grant execute on function public.save_room to service_role;

-- ---------------------------------------------------------------- results

create table public.games (
  id uuid primary key default gen_random_uuid(),
  game_key text not null unique,
  room_code text not null,
  played_at timestamptz not null,
  finished_at timestamptz,
  turn_count integer not null default 0,
  highest_score integer not null default 0,
  players jsonb not null default '[]',
  winner_id uuid,
  winner_name text,
  is_draw boolean not null default false,
  end_reason text,
  moves jsonb not null default '[]',
  words_played text[] not null default '{}',
  top_word jsonb not null default '{}'
);
create index games_played_at_idx on public.games (played_at desc);
alter table public.games enable row level security;
create policy "Signed-in users can read games"
  on public.games for select to authenticated using (true);

create table public.player_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  player_name text,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  win_percentage numeric not null default 0,
  total_points integer not null default 0,
  average_score integer not null default 0,
  highest_game_score integer not null default 0,
  highest_word_score integer not null default 0,
  highest_word text,
  longest_word text,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_played_at timestamptz
);
create index player_stats_wins_idx on public.player_stats (wins desc);
alter table public.player_stats enable row level security;
create policy "Signed-in users can read stats"
  on public.player_stats for select to authenticated using (true);
