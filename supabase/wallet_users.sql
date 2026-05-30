create extension if not exists pgcrypto;

create table if not exists public.wallet_users (
  wallet_address text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  connect_count integer not null default 1,
  latest_chain_id integer not null default 0,
  source text not null default 'web'
);

alter table public.wallet_users enable row level security;

revoke all on public.wallet_users from anon;

revoke all on public.wallet_users from authenticated;

create or replace function public.record_wallet_connection(
  p_wallet_address text,
  p_chain_id integer,
  p_source text default 'web'
)
returns public.wallet_users
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_wallet text;
  saved_user public.wallet_users;
begin
  normalized_wallet := lower(p_wallet_address);

  if normalized_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'INVALID_WALLET_ADDRESS';
  end if;

  insert into public.wallet_users (
    wallet_address,
    latest_chain_id,
    source
  )
  values (
    normalized_wallet,
    coalesce(p_chain_id, 0),
    coalesce(nullif(p_source, ''), 'web')
  )
  on conflict (wallet_address) do update
  set
    last_seen_at = now(),
    connect_count = public.wallet_users.connect_count + 1,
    latest_chain_id = excluded.latest_chain_id,
    source = excluded.source
  returning * into saved_user;

  return saved_user;
end;
$$;

grant execute on function public.record_wallet_connection(text, integer, text) to anon;

grant execute on function public.record_wallet_connection(text, integer, text) to authenticated;
