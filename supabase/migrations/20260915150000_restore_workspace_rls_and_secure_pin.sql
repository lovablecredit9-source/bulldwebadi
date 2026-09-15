-- Keep workspace persistence available through the publishable Supabase client.
-- PIN secrets live outside projects so public project reads never expose hashes/salts.

create table if not exists public.project_pins (
  project_id uuid primary key references public.projects(id) on delete cascade,
  pin_hash text,
  pin_salt text,
  pin_set_at timestamptz
);

alter table public.project_pins enable row level security;
revoke all on public.project_pins from anon, authenticated;

insert into public.project_pins (project_id, pin_hash, pin_salt, pin_set_at)
select id, pin_hash, pin_salt, pin_set_at
from public.projects
where pin_hash is not null or pin_salt is not null or pin_set_at is not null
on conflict (project_id) do update set
  pin_hash = excluded.pin_hash,
  pin_salt = excluded.pin_salt,
  pin_set_at = excluded.pin_set_at;

create or replace function public.pin_is_protected(p_project_id uuid)
returns boolean language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.project_pins
    where project_id = p_project_id and pin_hash is not null and pin_salt is not null
  );
$$;

create or replace function public.pin_get_salt(p_project_id uuid)
returns text language sql security definer set search_path = public
as $$
  select pin_salt from public.project_pins
  where project_id = p_project_id and pin_hash is not null
  limit 1;
$$;

create or replace function public.pin_verify_hash(p_project_id uuid, p_hash text)
returns boolean language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.project_pins
    where project_id = p_project_id and pin_hash = p_hash
  );
$$;

create or replace function public.pin_set_hash(p_project_id uuid, p_hash text, p_salt text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  insert into public.project_pins(project_id, pin_hash, pin_salt, pin_set_at)
  values (p_project_id, p_hash, p_salt, now())
  on conflict (project_id) do update set
    pin_hash = excluded.pin_hash,
    pin_salt = excluded.pin_salt,
    pin_set_at = now();
  return true;
end;
$$;

create or replace function public.pin_clear(p_project_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  delete from public.project_pins where project_id = p_project_id;
  return true;
end;
$$;

revoke all on function public.pin_is_protected(uuid) from public, anon, authenticated;
revoke all on function public.pin_get_salt(uuid) from public, anon, authenticated;
revoke all on function public.pin_verify_hash(uuid, text) from public, anon, authenticated;
revoke all on function public.pin_set_hash(uuid, text, text) from public, anon, authenticated;
revoke all on function public.pin_clear(uuid) from public, anon, authenticated;
grant execute on function public.pin_is_protected(uuid) to anon, authenticated;
grant execute on function public.pin_get_salt(uuid) to anon, authenticated;
grant execute on function public.pin_verify_hash(uuid, text) to anon, authenticated;
grant execute on function public.pin_set_hash(uuid, text, text) to anon, authenticated;
grant execute on function public.pin_clear(uuid) to anon, authenticated;

alter table public.projects enable row level security;
drop policy if exists projects_no_direct_access on public.projects;
create policy projects_public_crud on public.projects
  for all to anon, authenticated using (true) with check (true);

alter table public.project_files enable row level security;
create policy project_files_public_crud on public.project_files
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.projects to anon, authenticated;
grant select, insert, update, delete on public.project_files to anon, authenticated;
grant select, insert, update, delete on public.project_versions to anon, authenticated;
grant select, insert, update, delete on public.project_activities to anon, authenticated;
grant select, insert, update, delete on public.ai_chats to anon, authenticated;
grant select, insert, update, delete on public.ai_messages to anon, authenticated;

alter table public.project_versions enable row level security;
create policy project_versions_public_crud on public.project_versions
  for all to anon, authenticated using (true) with check (true);

alter table public.project_activities enable row level security;
create policy project_activities_public_crud on public.project_activities
  for all to anon, authenticated using (true) with check (true);

alter table public.ai_chats enable row level security;
create policy ai_chats_public_crud on public.ai_chats
  for all to anon, authenticated using (true) with check (true);

alter table public.ai_messages enable row level security;
create policy ai_messages_public_crud on public.ai_messages
  for all to anon, authenticated using (true) with check (true);

revoke all on public.project_pins from anon, authenticated;
revoke all on public.project_sessions from anon, authenticated;

alter table public.projects drop column if exists pin_hash;
alter table public.projects drop column if exists pin_salt;
alter table public.projects drop column if exists pin_set_at;
