create extension if not exists pgcrypto;

create table if not exists public.wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(20,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wallet_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.wallet_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username_snapshot text not null default '',
  amount numeric(20,2) not null check (amount > 0),
  method text not null default 'manual',
  reference text,
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','admin_credit','admin_debit','adjustment')),
  amount numeric(20,2) not null check (amount <> 0),
  balance_after numeric(20,2) not null check (balance_after >= 0),
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_deposits_user_created_idx on public.wallet_deposits(user_id, created_at desc);
create index if not exists wallet_deposits_status_created_idx on public.wallet_deposits(status, created_at desc);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);
alter table public.wallet_accounts enable row level security;
alter table public.wallet_pins enable row level security;
alter table public.wallet_deposits enable row level security;
alter table public.wallet_transactions enable row level security;

create or replace function public.wallet_set_pin(p_user_id uuid,p_pin_hash text,p_pin_salt text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  insert into public.wallet_pins(user_id,pin_hash,pin_salt,updated_at) values(p_user_id,p_pin_hash,p_pin_salt,now())
  on conflict(user_id) do update set pin_hash=excluded.pin_hash,pin_salt=excluded.pin_salt,updated_at=now();
  return true;
end; $$;
create or replace function public.wallet_get_pin(p_user_id uuid) returns table(pin_hash text,pin_salt text)
language sql security definer set search_path=public as $$ select pin_hash,pin_salt from public.wallet_pins where user_id=p_user_id limit 1; $$;

create or replace function public.wallet_credit(p_user_id uuid,p_amount numeric,p_type text,p_reference_type text default null,p_reference_id uuid default null,p_description text default null,p_created_by uuid default null) returns numeric
language plpgsql security definer set search_path=public as $$
declare v_balance numeric(20,2);
begin
 if p_amount is null or p_amount<=0 then raise exception 'Jumlah harus lebih dari 0'; end if;
 if p_type not in ('deposit','admin_credit','adjustment') then raise exception 'Tipe transaksi tidak valid'; end if;
 insert into public.wallet_accounts(user_id,balance) values(p_user_id,0) on conflict(user_id) do nothing;
 update public.wallet_accounts set balance=balance+p_amount,updated_at=now() where user_id=p_user_id returning balance into v_balance;
 insert into public.wallet_transactions(user_id,type,amount,balance_after,reference_type,reference_id,description,created_by) values(p_user_id,p_type,p_amount,v_balance,p_reference_type,p_reference_id,p_description,p_created_by);
 return v_balance;
end; $$;
create or replace function public.wallet_debit(p_user_id uuid,p_amount numeric,p_description text default null,p_created_by uuid default null) returns numeric
language plpgsql security definer set search_path=public as $$
declare v_balance numeric(20,2);
begin
 if p_amount is null or p_amount<=0 then raise exception 'Jumlah harus lebih dari 0'; end if;
 insert into public.wallet_accounts(user_id,balance) values(p_user_id,0) on conflict(user_id) do nothing;
 update public.wallet_accounts set balance=balance-p_amount,updated_at=now() where user_id=p_user_id and balance>=p_amount returning balance into v_balance;
 if v_balance is null then raise exception 'Saldo tidak mencukupi'; end if;
 insert into public.wallet_transactions(user_id,type,amount,balance_after,description,created_by) values(p_user_id,'admin_debit',-p_amount,v_balance,p_description,p_created_by);
 return v_balance;
end; $$;
create or replace function public.wallet_approve_deposit(p_deposit_id uuid,p_admin_id uuid,p_approve boolean,p_admin_note text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_deposit public.wallet_deposits%rowtype; v_balance numeric(20,2);
begin
 select * into v_deposit from public.wallet_deposits where id=p_deposit_id for update;
 if not found then raise exception 'Deposit tidak ditemukan'; end if;
 if v_deposit.status<>'pending' then raise exception 'Deposit sudah diproses'; end if;
 if p_approve then
   v_balance:=public.wallet_credit(v_deposit.user_id,v_deposit.amount,'deposit','wallet_deposit',v_deposit.id,coalesce(v_deposit.note,'Deposit disetujui admin'),p_admin_id);
   update public.wallet_deposits set status='approved',reviewed_by=p_admin_id,reviewed_at=now(),admin_note=p_admin_note where id=p_deposit_id;
 else
   update public.wallet_deposits set status='rejected',reviewed_by=p_admin_id,reviewed_at=now(),admin_note=p_admin_note where id=p_deposit_id;
 end if;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,'balance',v_balance);
end; $$;
revoke all on function public.wallet_set_pin(uuid,text,text) from public,anon,authenticated;
revoke all on function public.wallet_get_pin(uuid) from public,anon,authenticated;
revoke all on function public.wallet_credit(uuid,numeric,text,text,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.wallet_debit(uuid,numeric,text,uuid) from public,anon,authenticated;
revoke all on function public.wallet_approve_deposit(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.wallet_set_pin(uuid,text,text) to service_role;
grant execute on function public.wallet_get_pin(uuid) to service_role;
grant execute on function public.wallet_credit(uuid,numeric,text,text,uuid,text,uuid) to service_role;
grant execute on function public.wallet_debit(uuid,numeric,text,uuid) to service_role;
grant execute on function public.wallet_approve_deposit(uuid,uuid,boolean,text) to service_role;
create or replace function public.set_wallet_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists wallet_accounts_updated_at on public.wallet_accounts;
create trigger wallet_accounts_updated_at before update on public.wallet_accounts for each row execute function public.set_wallet_updated_at();
drop trigger if exists wallet_pins_updated_at on public.wallet_pins;
create trigger wallet_pins_updated_at before update on public.wallet_pins for each row execute function public.set_wallet_updated_at();