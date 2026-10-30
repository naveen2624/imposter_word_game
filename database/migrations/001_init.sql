create extension if not exists pgcrypto;

create table profiles (id uuid primary key references auth.users on delete cascade, username text, avatar_url text, created_at timestamptz default now());
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, username) values (new.id, coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1), 'Guest'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create table words (id serial primary key, category text not null, word text not null, hint text not null, unique(category, word));

create table game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  host_id uuid not null references auth.users,
  max_players int not null check (max_players between 3 and 10),
  imposter_count int not null check (imposter_count between 1 and 3),
  total_rounds int not null check (total_rounds between 1 and 10),
  turn_time_limit int not null check (turn_time_limit in (15,30,45,60)),
  word_category text not null default 'Random',
  hint_enabled boolean not null default true,
  custom_hint text,
  hint_difficulty text not null default 'Easy' check (hint_difficulty in ('Easy','Medium','Hard')),
  allow_host_to_play boolean not null default true,
  status text not null default 'lobby' check (status in ('lobby','playing','voting','finished','closed')),
  current_round int not null default 0,
  current_turn int not null default 0,
  turn_deadline timestamptz,
  turn_order uuid[] not null default '{}',
  voting_round int not null default 1,
  candidates uuid[] not null default '{}',
  locked uuid[] not null default '{}',
  created_at timestamptz default now(),
  check (imposter_count < max_players)
);
create table game_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms on delete cascade,
  user_id uuid not null references auth.users,
  display_name text not null,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  is_playing boolean not null default true,
  connection_status text not null default 'connected',
  joined_at timestamptz default now(),
  unique (room_id, user_id)
);
create table game_roles   (room_id uuid references game_rooms on delete cascade, user_id uuid, role text not null check (role in ('player','imposter')), primary key (room_id, user_id));
create table game_secrets (room_id uuid primary key references game_rooms on delete cascade, secret_word text not null, hint text, category text);
create table player_clues (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms on delete cascade,
  round_number int not null, user_id uuid not null, clue text not null default '',
  is_skipped boolean not null default false, submitted_at timestamptz default now(),
  unique (room_id, round_number, user_id)
);
create table player_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms on delete cascade,
  voter_id uuid not null, voted_player_id uuid not null, voting_round int not null default 1,
  created_at timestamptz default now(),
  unique (room_id, voting_round, voter_id), check (voter_id <> voted_player_id)
);
create table game_results (
  room_id uuid primary key references game_rooms on delete cascade,
  winning_team text not null check (winning_team in ('players','imposters')),
  imposter_ids uuid[] not null, vote_summary jsonb, completed_at timestamptz default now()
);
create index on game_players (room_id);
create index on player_clues (room_id, round_number);
create index on player_votes (room_id, voting_round);

-- ---------- RLS: clients may only READ their own room's public state. All writes go through the server. ----------
create function is_member(p_room uuid) returns boolean language sql security definer stable set search_path = public as
$$ select exists(select 1 from game_players where room_id = p_room and user_id = auth.uid()) $$;
alter table profiles enable row level security; alter table words enable row level security;
alter table game_rooms enable row level security; alter table game_players enable row level security;
alter table game_roles enable row level security; alter table game_secrets enable row level security;
alter table player_clues enable row level security; alter table player_votes enable row level security;
alter table game_results enable row level security;
create policy profiles_read on profiles for select using (true);
create policy profiles_update on profiles for update using (id = auth.uid());
create policy rooms_read on game_rooms for select using (is_member(id) or host_id = auth.uid());
create policy players_read on game_players for select using (is_member(room_id));
create policy clues_read on player_clues for select using (is_member(room_id));
create policy results_read on game_results for select using (is_member(room_id));
-- no policies on words, game_roles, game_secrets, player_votes => unreadable by clients (votes stay secret)

alter publication supabase_realtime add table game_rooms, game_players, player_clues, game_results;

-- ---------- Game logic (service_role only) ----------
create function _advance(p_room uuid) returns void language plpgsql as $$
declare r game_rooms;
begin
  select * into r from game_rooms where id = p_room;
  if r.current_turn + 1 < array_length(r.turn_order, 1) then
    update game_rooms set current_turn = current_turn + 1, turn_deadline = now() + make_interval(secs => turn_time_limit) where id = p_room;
  elsif r.current_round < r.total_rounds then
    update game_rooms set current_round = current_round + 1, current_turn = 0, turn_deadline = now() + make_interval(secs => turn_time_limit) where id = p_room;
  else
    update game_rooms set status = 'voting', turn_deadline = null, candidates = turn_order, voting_round = 1, locked = '{}' where id = p_room;
  end if;
end $$;

create function start_game(p_room uuid, p_user uuid) returns void language plpgsql as $$
declare r game_rooms; ids uuid[]; w words; n int;
begin
  select * into r from game_rooms where id = p_room for update;
  if r.host_id <> p_user then raise exception 'Only the host can start'; end if;
  if r.status <> 'lobby' then raise exception 'Game already started'; end if;
  select array_agg(user_id order by random()) into ids from game_players where room_id = p_room and is_playing;
  n := coalesce(array_length(ids, 1), 0);
  if n < 3 then raise exception 'Need at least 3 players'; end if;
  if r.imposter_count >= n then raise exception 'Too many imposters for this player count'; end if;
  if exists (select 1 from game_players where room_id = p_room and is_playing and not is_ready) then raise exception 'All players must be ready'; end if;
  select * into w from words where r.word_category = 'Random' or category = r.word_category order by random() limit 1;
  if w.id is null then raise exception 'No words for category'; end if;
  insert into game_secrets values (p_room, w.word, coalesce(nullif(r.custom_hint, ''), w.hint), w.category);
  insert into game_roles select p_room, u, case when u = any (ids[1:r.imposter_count]) then 'imposter' else 'player' end from unnest(ids) u;
  update game_rooms set status = 'playing', current_round = 1, current_turn = 0,
    turn_order = (select array_agg(u order by random()) from unnest(ids) u),
    turn_deadline = now() + make_interval(secs => turn_time_limit) where id = p_room;
end $$;

create function tick(p_room uuid) returns void language plpgsql as $$
declare r game_rooms;
begin
  select * into r from game_rooms where id = p_room for update;
  if r.status = 'playing' and now() >= r.turn_deadline then
    insert into player_clues(room_id, round_number, user_id, clue, is_skipped)
    values (p_room, r.current_round, r.turn_order[r.current_turn + 1], '', true) on conflict do nothing;
    perform _advance(p_room);
  end if;
end $$;

create function submit_clue(p_room uuid, p_user uuid, p_clue text) returns void language plpgsql as $$
declare r game_rooms;
begin
  perform tick(p_room);
  select * into r from game_rooms where id = p_room for update;
  if r.status <> 'playing' then raise exception 'Not in clue phase'; end if;
  if r.turn_order[r.current_turn + 1] <> p_user then raise exception 'Not your turn'; end if;
  insert into player_clues(room_id, round_number, user_id, clue) values (p_room, r.current_round, p_user, p_clue);
  perform _advance(p_room);
end $$;

create function _tally(p_room uuid) returns void language plpgsql as $$
declare r game_rooms; need int; cutoff bigint; above uuid[]; tied uuid[]; accused uuid[]; imps uuid[]; summary jsonb;
begin
  select * into r from game_rooms where id = p_room for update;
  need := r.imposter_count - coalesce(array_length(r.locked, 1), 0);
  create temp table _c on commit drop as
    select u as uid, (select count(*) from player_votes v where v.room_id = p_room and v.voting_round = r.voting_round and v.voted_player_id = u) cnt
    from unnest(r.candidates) u;
  select cnt into cutoff from (select cnt, row_number() over (order by cnt desc) rn from _c) s where rn = need;
  select coalesce(array_agg(uid), '{}') into above from _c where cnt > cutoff;
  select coalesce(array_agg(uid), '{}') into tied  from _c where cnt = cutoff;
  if array_length(tied, 1) = need - coalesce(array_length(above, 1), 0) or array_length(tied, 1) is null then
    accused := r.locked || above || tied;
  elsif r.voting_round = 1 then
    update game_rooms set voting_round = 2, locked = r.locked || above, candidates = tied where id = p_room;  -- revote among tied
    return;
  else
    accused := null;  -- still tied after revote => imposters win
  end if;
  select array_agg(user_id) into imps from game_roles where room_id = p_room and role = 'imposter';
  select jsonb_object_agg(voted_player_id, c) into summary from (select voted_player_id, count(*) c from player_votes where room_id = p_room and voting_round = 1 group by 1) t;
  insert into game_results(room_id, winning_team, imposter_ids, vote_summary)
  values (p_room, case when accused is not null and accused @> imps and imps @> accused then 'players' else 'imposters' end, imps, summary);
  update game_rooms set status = 'finished' where id = p_room;
end $$;

create function submit_vote(p_room uuid, p_user uuid, p_target uuid) returns void language plpgsql as $$
declare r game_rooms;
begin
  select * into r from game_rooms where id = p_room for update;
  if r.status <> 'voting' then raise exception 'Voting is not open'; end if;
  if not (p_user = any (r.turn_order)) then raise exception 'You are not a participant'; end if;
  if p_user = p_target then raise exception 'You cannot vote for yourself'; end if;
  if not (p_target = any (r.candidates)) then raise exception 'Invalid candidate'; end if;
  begin
    insert into player_votes(room_id, voter_id, voted_player_id, voting_round) values (p_room, p_user, p_target, r.voting_round);
  exception when unique_violation then raise exception 'You already voted'; end;
  if (select count(*) from player_votes where room_id = p_room and voting_round = r.voting_round) >= array_length(r.turn_order, 1) then
    perform _tally(p_room);
  end if;
end $$;

create function close_voting(p_room uuid, p_user uuid) returns void language plpgsql as $$
declare r game_rooms;
begin  -- host resolves abandoned votes
  select * into r from game_rooms where id = p_room for update;
  if r.host_id <> p_user then raise exception 'Only the host can close voting'; end if;
  if r.status <> 'voting' then raise exception 'Voting is not open'; end if;
  perform _tally(p_room);
end $$;

revoke all on function _advance, start_game, tick, submit_clue, _tally, submit_vote, close_voting from public, anon, authenticated;
grant execute on function start_game, tick, submit_clue, submit_vote, close_voting to service_role;
