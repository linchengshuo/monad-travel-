create extension if not exists pgcrypto; -- 开启 UUID 自动生成能力，room_types 的 id 会用到它。

create table if not exists public.room_types ( -- 创建房型表，用户侧只读取这张表里的真实房型。
  id uuid primary key default gen_random_uuid(), -- 房型编号，由数据库自动生成。
  merchant_application_id uuid not null references public.merchant_applications(id) on delete cascade, -- 关联已审核商家的入驻申请。
  merchant_name text not null default '', -- 商家或酒店名称，用户侧酒店列表会显示它。
  owner_wallet text not null, -- 商家钱包地址，用来读取商家自己的房型。
  hotel_id text not null, -- 酒店编号；当前用商家申请 id 作为酒店编号。
  name text not null, -- 房型名称。
  description text not null default '', -- 房型详情。
  image_url text not null default '', -- 房型主图 URL，来自 Supabase Storage。
  gallery_urls text[] not null default '{}', -- 房型图片组 URL。
  price numeric not null check (price >= 0), -- 房型价格，不能小于 0。
  currency text not null check (currency in ('MON')), -- 收款币种，MVP 阶段只允许 MON。
  valid_until date not null, -- 有效期。
  total_inventory integer not null check (total_inventory >= 0), -- 总库存。
  booked_inventory integer not null default 0 check (booked_inventory >= 0), -- 已订库存。
  area text not null default '', -- 面积。
  bed text not null default '', -- 床型。
  breakfast text not null default '', -- 早餐。
  cancellation text not null default '', -- 取消规则。
  is_active boolean not null default true, -- 是否上架。
  created_at timestamptz not null default now(), -- 创建时间。
  updated_at timestamptz not null default now(), -- 更新时间。
  constraint room_types_booked_not_over_total check (booked_inventory <= total_inventory) -- 防止已订库存超过总库存。
); -- 房型表创建结束。

alter table public.room_types add column if not exists merchant_name text not null default ''; -- 如果旧表已经存在，就补商家名称字段。

create or replace function public.set_updated_at() -- 创建通用更新时间函数。
returns trigger -- 声明这是触发器函数。
language plpgsql -- 使用 Postgres 的过程语言。
as $$ -- 函数正文开始。
begin -- 函数逻辑开始。
  new.updated_at = now(); -- 每次更新时刷新 updated_at。
  return new; -- 返回更新后的行。
end; -- 函数逻辑结束。
$$; -- 函数正文结束。

drop trigger if exists room_types_set_updated_at on public.room_types; -- 删除旧触发器，方便重复运行。
create trigger room_types_set_updated_at -- 创建更新时间触发器。
before update on public.room_types -- 更新前执行。
for each row -- 每一行都执行。
execute function public.set_updated_at(); -- 调用更新时间函数。

alter table public.room_types enable row level security; -- 开启 RLS 行级权限。

grant usage on schema public to anon, authenticated; -- 允许前端访问 public schema。
grant select on public.room_types to anon, authenticated; -- 允许用户和商家读取房型。
grant insert, update on public.room_types to anon, authenticated; -- MVP 阶段允许前端写入房型，生产版应改 Edge Function 验签。

drop policy if exists "anyone can read active room types" on public.room_types; -- 删除旧读取策略，方便重复运行。
drop policy if exists "approved merchants can create room types" on public.room_types; -- 删除旧新增策略，方便重复运行。
drop policy if exists "approved merchants can update own room types" on public.room_types; -- 删除旧更新策略，方便重复运行。

create policy "anyone can read active room types" -- 创建公开读取上架房型策略。
on public.room_types -- 策略作用在房型表。
for select -- 允许查询。
to anon, authenticated -- 未登录和已登录都能查。
using (is_active = true); -- 只能查上架房型。

create policy "approved merchants can create room types" -- 创建已审核商家新增房型策略。
on public.room_types -- 策略作用在房型表。
for insert -- 允许新增。
to anon, authenticated -- MVP 阶段前端使用 anon key。
with check ( -- 新增数据必须满足下面条件。
  owner_wallet = lower(owner_wallet) -- 钱包地址必须小写。
  and exists ( -- 必须存在已审核商家申请。
    select 1 -- 只判断存在。
    from public.merchant_applications -- 从商家申请表检查。
    where merchant_applications.id = room_types.merchant_application_id -- 申请 id 必须匹配。
      and merchant_applications.owner_wallet = room_types.owner_wallet -- 钱包地址必须匹配。
      and merchant_applications.status = 'approved' -- 商家必须已审核通过。
  ) -- 已审核商家检查结束。
); -- 新增策略结束。

create policy "approved merchants can update own room types" -- 创建已审核商家更新房型策略。
on public.room_types -- 策略作用在房型表。
for update -- 允许更新。
to anon, authenticated -- MVP 阶段前端使用 anon key。
using ( -- 更新前必须满足下面条件。
  exists ( -- 必须存在已审核商家申请。
    select 1 -- 只判断存在。
    from public.merchant_applications -- 从商家申请表检查。
    where merchant_applications.id = room_types.merchant_application_id -- 申请 id 必须匹配。
      and merchant_applications.owner_wallet = room_types.owner_wallet -- 钱包地址必须匹配。
      and merchant_applications.status = 'approved' -- 商家必须已审核通过。
  ) -- 更新前检查结束。
) -- using 条件结束。
with check ( -- 更新后也必须满足下面条件。
  owner_wallet = lower(owner_wallet) -- 钱包地址必须小写。
  and exists ( -- 必须仍然属于已审核商家。
    select 1 -- 只判断存在。
    from public.merchant_applications -- 从商家申请表检查。
    where merchant_applications.id = room_types.merchant_application_id -- 申请 id 必须匹配。
      and merchant_applications.owner_wallet = room_types.owner_wallet -- 钱包地址必须匹配。
      and merchant_applications.status = 'approved' -- 商家必须已审核通过。
  ) -- 更新后检查结束。
); -- 更新策略结束。

notify pgrst, 'reload schema'; -- 通知 Supabase PostgREST 刷新 schema cache，否则前端可能仍提示找不到表。
