-- Harden the admin deposit workflow.
-- The browser may call the Admin API, but the database remains the source of truth.
-- Approval/rejection is atomic and the deposit row is locked before any balance change.

create unique index if not exists wallet_transactions_deposit_reference_unique
on public.wallet_transactions(reference_id)
where reference_type = 'wallet_deposit' and type = 'deposit';

create or replace function public.wallet_credit(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_description text default null,
  p_created_by uuid default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(20,2);
begin
  if auth.uid() is null or p_created_by is null or p_created_by <> auth.uid() then
    raise exception 'Sesi Administrator tidak valid';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(coalesce(u.email, '')) = lower('panpakarak36@gmail.com')
  ) then
    raise exception 'Akses Administrator diperlukan';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Jumlah harus lebih dari 0';
  end if;

  if p_type not in ('deposit','admin_credit','adjustment') then
    raise exception 'Tipe transaksi tidak valid';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'User pemilik deposit tidak ditemukan';
  end if;

  insert into public.wallet_accounts(user_id,balance)
  values(p_user_id,0)
  on conflict(user_id) do nothing;

  update public.wallet_accounts
  set balance = balance + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  if v_balance is null then
    raise exception 'Saldo user gagal diperbarui';
  end if;

  insert into public.wallet_transactions(
    user_id,type,amount,balance_after,reference_type,reference_id,description,created_by
  )
  values(
    p_user_id,p_type,p_amount,v_balance,p_reference_type,p_reference_id,
    p_description,auth.uid()
  );

  return v_balance;
end;
$$;

create or replace function public.wallet_approve_deposit(
  p_deposit_id uuid,
  p_admin_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit public.wallet_deposits%rowtype;
  v_balance numeric(20,2);
begin
  if auth.uid() is null or p_admin_id is null or p_admin_id <> auth.uid() then
    raise exception 'Sesi Administrator tidak valid';
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(coalesce(u.email, '')) = lower('panpakarak36@gmail.com')
  ) then
    raise exception 'Akses Administrator diperlukan';
  end if;

  if p_deposit_id is null then
    raise exception 'ID deposit tidak valid';
  end if;

  -- Lock the exact deposit row. Concurrent approval requests serialize here.
  select *
  into v_deposit
  from public.wallet_deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'Deposit tidak ditemukan';
  end if;

  if v_deposit.status <> 'pending' then
    raise exception 'Deposit sudah diproses (status: %)', v_deposit.status;
  end if;

  if not exists (select 1 from auth.users u where u.id = v_deposit.user_id) then
    raise exception 'User pemilik deposit tidak ditemukan';
  end if;

  if v_deposit.amount is null or v_deposit.amount <= 0 then
    raise exception 'Jumlah deposit tidak valid';
  end if;

  if p_approve then
    v_balance := public.wallet_credit(
      v_deposit.user_id,
      v_deposit.amount,
      'deposit',
      'wallet_deposit',
      v_deposit.id,
      coalesce(v_deposit.note,'Deposit disetujui admin'),
      p_admin_id
    );

    update public.wallet_deposits
    set status = 'approved',
        reviewed_by = p_admin_id,
        reviewed_at = now(),
        admin_note = p_admin_note
    where id = p_deposit_id
      and status = 'pending';

    if not found then
      raise exception 'Deposit berubah saat proses konfirmasi';
    end if;
  else
    update public.wallet_deposits
    set status = 'rejected',
        reviewed_by = p_admin_id,
        reviewed_at = now(),
        admin_note = p_admin_note
    where id = p_deposit_id
      and status = 'pending';

    if not found then
      raise exception 'Deposit berubah saat proses penolakan';
    end if;
  end if;

  raise log '[ADMIN DEPOSIT] depositId=% adminId=% statusSebelum=pending userId=% amount=% statusSesudah=% balance=%',
    v_deposit.id,
    p_admin_id,
    v_deposit.user_id,
    v_deposit.amount,
    case when p_approve then 'approved' else 'rejected' end,
    v_balance;

  return jsonb_build_object(
    'status', case when p_approve then 'approved' else 'rejected' end,
    'balance', v_balance,
    'deposit_id', v_deposit.id,
    'user_id', v_deposit.user_id,
    'amount', v_deposit.amount
  );
end;
$$;

revoke all on function public.wallet_approve_deposit(uuid,uuid,boolean,text) from public, anon;
revoke all on function public.wallet_credit(uuid,numeric,text,text,uuid,text,uuid) from public, anon;
grant execute on function public.wallet_approve_deposit(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.wallet_credit(uuid,numeric,text,text,uuid,text,uuid) to authenticated;
