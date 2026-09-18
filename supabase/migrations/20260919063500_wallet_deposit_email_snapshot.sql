alter table public.wallet_deposits
  add column if not exists email_snapshot text;

update public.wallet_deposits wd
set email_snapshot = u.email
from auth.users u
where wd.user_id = u.id
  and (wd.email_snapshot is null or wd.email_snapshot = '');

create index if not exists wallet_deposits_email_snapshot_idx
  on public.wallet_deposits(email_snapshot);
