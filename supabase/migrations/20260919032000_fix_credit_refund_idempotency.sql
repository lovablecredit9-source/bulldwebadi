-- Allow one AI request to have both its consume and refund ledger entries.
drop index if exists public.credit_transactions_request_unique;

create unique index if not exists credit_transactions_request_kind_unique
  on public.credit_transactions (user_id, request_id, kind)
  where request_id is not null;

create or replace function public.credit_refund(
  p_request_id uuid,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  tx public.credit_transactions%rowtype;
  row public.credit_accounts%rowtype;
  free_used integer := 0;
  pro_used integer := 0;
  paid_used integer := 0;
  tx_free_day text;
  tx_free_month text;
begin
  if uid is null then
    raise exception 'Sesi login diperlukan.';
  end if;

  select * into tx
  from public.credit_transactions
  where user_id = uid
    and request_id = p_request_id
    and kind = 'ai_consume'
  order by created_at desc
  limit 1;

  if not found then
    return public.credit_get_status();
  end if;

  if exists (
    select 1
    from public.credit_transactions
    where user_id = uid
      and request_id = p_request_id
      and kind = 'ai_refund'
  ) then
    return public.credit_get_status();
  end if;

  free_used := coalesce(substring(coalesce(tx.source,'') from 'free=([0-9]+)')::integer,0);
  pro_used := coalesce(substring(coalesce(tx.source,'') from 'pro=([0-9]+)')::integer,0);
  paid_used := coalesce(substring(coalesce(tx.source,'') from 'paid=([0-9]+)')::integer,0);
  tx_free_day := substring(coalesce(tx.source,'') from 'free_day=([0-9]{4}-[0-9]{2}-[0-9]{2})');
  tx_free_month := substring(coalesce(tx.source,'') from 'free_month=([0-9]{4}-[0-9]{2}-01)');

  select * into row
  from public.credit_accounts
  where user_id = uid
  for update;

  if tx_free_day is null or row.free_day_key::text = tx_free_day then
    row.free_day_used := greatest(0, row.free_day_used - free_used);
  end if;

  if tx_free_month is null or row.free_month_key::text = tx_free_month then
    row.free_month_used := greatest(0, row.free_month_used - free_used);
  end if;

  row.pro_month_remaining := row.pro_month_remaining + pro_used;
  row.paid_credits := row.paid_credits + paid_used;

  update public.credit_accounts
  set free_day_used = row.free_day_used,
      free_month_used = row.free_month_used,
      pro_month_remaining = row.pro_month_remaining,
      paid_credits = row.paid_credits,
      updated_at = now()
  where user_id = uid;

  insert into public.credit_transactions(
    user_id, kind, credits, source, request_id, description
  )
  values(
    uid,
    'ai_refund',
    abs(tx.credits),
    format('free=%s,pro=%s,paid=%s', free_used, pro_used, paid_used),
    p_request_id,
    coalesce(p_description,'Kredit dikembalikan karena proses AI gagal.')
  );

  return public.credit_get_status();
end;
$function$;
