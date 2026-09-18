create table if not exists public.wallet_payment_settings (
  id smallint primary key default 1 check (id = 1),
  dana_number text,
  dana_name text,
  ovo_number text,
  ovo_name text,
  gopay_number text,
  gopay_name text,
  qris_image_url text,
  updated_at timestamptz not null default now()
);

insert into public.wallet_payment_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.wallet_payment_settings enable row level security;

grant select on public.wallet_payment_settings to authenticated;
grant update on public.wallet_payment_settings to authenticated;

drop policy if exists wallet_payment_settings_select_authenticated on public.wallet_payment_settings;
create policy wallet_payment_settings_select_authenticated
on public.wallet_payment_settings
for select
to authenticated
using (true);

drop policy if exists wallet_payment_settings_update_admin on public.wallet_payment_settings;
create policy wallet_payment_settings_update_admin
on public.wallet_payment_settings
for update
to authenticated
using (auth.jwt()->>'email' = 'panpakarak36@gmail.com')
with check (auth.jwt()->>'email' = 'panpakarak36@gmail.com');

create or replace function public.wallet_payment_settings_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallet_payment_settings_updated_at on public.wallet_payment_settings;
create trigger wallet_payment_settings_updated_at
before update on public.wallet_payment_settings
for each row execute function public.wallet_payment_settings_updated_at();
