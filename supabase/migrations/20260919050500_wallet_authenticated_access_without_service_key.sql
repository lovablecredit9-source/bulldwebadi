-- Allow the wallet API to operate with the signed-in user's JWT and the project's publishable key.
-- Existing wallet schema/migration is unchanged.
-- Administrative RPCs are guarded by the administrator email in the JWT.

create or replace function public.wallet_set_pin(p_user_id uuid,p_pin_hash text,p_pin_salt text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Tidak diizinkan'; end if;
  insert into public.wallet_pins(user_id,pin_hash,pin_salt,updated_at)
  values(p_user_id,p_pin_hash,p_pin_salt,now())
  on conflict(user_id) do update set pin_hash=excluded.pin_hash,pin_salt=excluded.pin_salt,updated_at=now();
  return true;
end; $$;

create or replace function public.wallet_get_pin(p_user_id uuid) returns table(pin_hash text,pin_salt text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Tidak diizinkan'; end if;
  return query select wp.pin_hash,wp.pin_salt from public.wallet_pins wp where wp.user_id=p_user_id limit 1;
end; $$;

create or replace function public.wallet_credit(p_user_id uuid,p_amount numeric,p_type text,p_reference_type text default null,p_reference_id uuid default null,p_description text default null,p_created_by uuid default null) returns numeric
language plpgsql security definer set search_path=public as $$
declare v_balance numeric(20,2);
begin
  if auth.jwt()->>'email' <> 'panpakarak36@gmail.com' then raise exception 'Akses Administrator diperlukan'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  if p_type not in ('deposit','admin_credit','adjustment') then raise exception 'Tipe transaksi tidak valid'; end if;
  insert into public.wallet_accounts(user_id,balance) values(p_user_id,0) on conflict(user_id) do nothing;
  update public.wallet_accounts set balance=balance+p_amount,updated_at=now() where user_id=p_user_id returning balance into v_balance;
  insert into public.wallet_transactions(user_id,type,amount,balance_after,reference_type,reference_id,description,created_by)
  values(p_user_id,p_type,p_amount,v_balance,p_reference_type,p_reference_id,p_description,coalesce(p_created_by,auth.uid()));
  return v_balance;
end; $$;

create or replace function public.wallet_debit(p_user_id uuid,p_amount numeric,p_description text default null,p_created_by uuid default null) returns numeric
language plpgsql security definer set search_path=public as $$
declare v_balance numeric(20,2);
begin
  if auth.jwt()->>'email' <> 'panpakarak36@gmail.com' then raise exception 'Akses Administrator diperlukan'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  insert into public.wallet_accounts(user_id,balance) values(p_user_id,0) on conflict(user_id) do nothing;
  update public.wallet_accounts set balance=balance-p_amount,updated_at=now() where user_id=p_user_id and balance>=p_amount returning balance into v_balance;
  if v_balance is null then raise exception 'Saldo tidak mencukupi'; end if;
  insert into public.wallet_transactions(user_id,type,amount,balance_after,description,created_by)
  values(p_user_id,'admin_debit',-p_amount,v_balance,p_description,coalesce(p_created_by,auth.uid()));
  return v_balance;
end; $$;

create or replace function public.wallet_approve_deposit(p_deposit_id uuid,p_admin_id uuid,p_approve boolean,p_admin_note text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_deposit public.wallet_deposits%rowtype; v_balance numeric(20,2);
begin
  if auth.jwt()->>'email' <> 'panpakarak36@gmail.com' then raise exception 'Akses Administrator diperlukan'; end if;
  select * into v_deposit from public.wallet_deposits where id=p_deposit_id for update;
  if not found then raise exception 'Deposit tidak ditemukan'; end if;
  if v_deposit.status<>'pending' then raise exception 'Deposit sudah diproses'; end if;
  if p_approve then
    v_balance:=public.wallet_credit(v_deposit.user_id,v_deposit.amount,'deposit','wallet_deposit',v_deposit.id,coalesce(v_deposit.note,'Deposit disetujui admin'),coalesce(p_admin_id,auth.uid()));
    update public.wallet_deposits set status='approved',reviewed_by=coalesce(p_admin_id,auth.uid()),reviewed_at=now(),admin_note=p_admin_note where id=p_deposit_id;
  else
    update public.wallet_deposits set status='rejected',reviewed_by=coalesce(p_admin_id,auth.uid()),reviewed_at=now(),admin_note=p_admin_note where id=p_deposit_id;
  end if;
  return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,'balance',v_balance);
end; $$;

create or replace function public.wallet_find_user_by_username(p_username text) returns uuid
language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid;
begin
  if auth.jwt()->>'email' <> 'panpakarak36@gmail.com' then raise exception 'Akses Administrator diperlukan'; end if;
  select id into v_user_id from auth.users
  where lower(coalesce(raw_user_meta_data->>'username',split_part(email,'@',1)))=lower(trim(p_username)) limit 1;
  return v_user_id;
end; $$;

grant select on public.wallet_accounts, public.wallet_deposits, public.wallet_transactions to authenticated;
grant insert on public.wallet_deposits to authenticated;
grant execute on function public.wallet_set_pin(uuid,text,text) to authenticated;
grant execute on function public.wallet_get_pin(uuid) to authenticated;
grant execute on function public.wallet_credit(uuid,numeric,text,text,uuid,text,uuid) to authenticated;
grant execute on function public.wallet_debit(uuid,numeric,text,uuid) to authenticated;
grant execute on function public.wallet_approve_deposit(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.wallet_find_user_by_username(text) to authenticated;

drop policy if exists wallet_accounts_select_own on public.wallet_accounts;
create policy wallet_accounts_select_own on public.wallet_accounts for select to authenticated
using (user_id=auth.uid() or auth.jwt()->>'email'='panpakarak36@gmail.com');

drop policy if exists wallet_deposits_select_own on public.wallet_deposits;
create policy wallet_deposits_select_own on public.wallet_deposits for select to authenticated
using (user_id=auth.uid() or auth.jwt()->>'email'='panpakarak36@gmail.com');

drop policy if exists wallet_deposits_insert_own on public.wallet_deposits;
create policy wallet_deposits_insert_own on public.wallet_deposits for insert to authenticated
with check (user_id=auth.uid());

drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
create policy wallet_transactions_select_own on public.wallet_transactions for select to authenticated
using (user_id=auth.uid() or auth.jwt()->>'email'='panpakarak36@gmail.com');

drop policy if exists wallet_pins_no_direct_access on public.wallet_pins;
create policy wallet_pins_no_direct_access on public.wallet_pins for all to authenticated using (false) with check (false);

revoke all on public.wallet_accounts,public.wallet_pins,public.wallet_deposits,public.wallet_transactions from anon;
revoke insert,update,delete on public.wallet_accounts from authenticated;
revoke insert,update,delete on public.wallet_transactions from authenticated;
