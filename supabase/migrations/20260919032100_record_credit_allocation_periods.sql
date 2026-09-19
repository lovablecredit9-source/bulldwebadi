-- Record the allocation period used by free credits so a late refund
-- cannot decrement a newer day's/month's allowance.
create or replace function public.credit_consume(
  p_amount integer,
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
  row public.credit_accounts%rowtype;
  remaining integer := p_amount;
  use_free integer := 0;
  use_pro integer := 0;
  use_paid integer := 0;
  today date := ((now() at time zone 'Asia/Jakarta')::date);
  month_start date := (date_trunc('month', now() at time zone 'Asia/Jakarta')::date);
begin
  if uid is null then raise exception 'Sesi login diperlukan.'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100 then raise exception 'Jumlah kredit tidak valid.'; end if;
  if p_request_id is null then raise exception 'Request kredit tidak valid.'; end if;

  insert into public.credit_accounts(user_id) values(uid) on conflict(user_id) do nothing;
  select * into row from public.credit_accounts where user_id=uid for update;

  if row.free_day_key <> today then row.free_day_key := today; row.free_day_used := 0; end if;
  if row.free_month_key <> month_start then row.free_month_key := month_start; row.free_month_used := 0; end if;

  if row.pro_active_until is null or row.pro_active_until <= now() then
    row.pro_plan := null; row.pro_month_key := null; row.pro_month_remaining := 0;
  elsif row.pro_month_key is distinct from month_start then
    row.pro_month_key := month_start;
    row.pro_month_remaining := case when row.pro_plan='pro-50' then 50 when row.pro_plan='pro-100' then 100 else 0 end;
  end if;

  if exists(select 1 from public.credit_transactions where user_id=uid and request_id=p_request_id and kind='ai_consume') then
    return public.credit_get_status();
  end if;

  use_free := least(remaining, greatest(0, least(5-row.free_day_used, 30-row.free_month_used)));
  remaining := remaining - use_free;
  use_pro := least(remaining, greatest(0, row.pro_month_remaining));
  remaining := remaining - use_pro;
  use_paid := remaining;

  if use_paid > row.paid_credits then
    raise exception 'Kredit tidak cukup. Dibutuhkan %, tersedia %.', p_amount, row.paid_credits + use_free + use_pro;
  end if;

  row.free_day_used := row.free_day_used + use_free;
  row.free_month_used := row.free_month_used + use_free;
  row.pro_month_remaining := row.pro_month_remaining - use_pro;
  row.paid_credits := row.paid_credits - use_paid;

  update public.credit_accounts set
    paid_credits=row.paid_credits, free_day_key=row.free_day_key, free_day_used=row.free_day_used,
    free_month_key=row.free_month_key, free_month_used=row.free_month_used,
    pro_plan=row.pro_plan, pro_active_until=row.pro_active_until, pro_month_key=row.pro_month_key,
    pro_month_remaining=row.pro_month_remaining, updated_at=now()
  where user_id=uid;

  insert into public.credit_transactions(user_id,kind,credits,source,request_id,description)
  values(
    uid,
    'ai_consume',
    -p_amount,
    concat(
      'free=',use_free,
      ',free_day=',row.free_day_key,
      ',free_month=',row.free_month_key,
      ',pro=',use_pro,
      ',paid=',use_paid
    ),
    p_request_id,
    p_description
  );

  return public.credit_get_status();
end;
$function$;
