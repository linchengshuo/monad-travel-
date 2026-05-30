create extension if not exists pgcrypto; -- 开启 UUID 生成能力，UUID 可以理解为数据库自动生成的唯一编号。

create table if not exists public.merchant_applications ( -- 创建商家入驻申请表。
  id uuid primary key default gen_random_uuid(), -- 申请编号，数据库会自动生成。
  owner_wallet text not null, -- 商家连接的钱包地址，用来绑定这份申请属于哪个钱包。
  company_name text not null, -- 商家或企业主体名称。
  license_id text not null, -- 营业执照编号。
  contact_name text not null, -- 联系人姓名。
  contact_phone text not null, -- 联系人电话。
  qualification text not null default '', -- 资质说明。
  document_url text not null default '', -- 资质文件链接，后续可以换成 Supabase Storage 上传地址。
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')), -- 审核状态，pending 是待审核，approved 是通过，rejected 是拒绝。
  reviewer_note text not null default '', -- 审核人员备注。
  reviewed_by uuid references auth.users(id), -- 审核人员账号编号，关联 Supabase 登录用户。
  reviewed_at timestamptz, -- 审核时间。
  created_at timestamptz not null default now(), -- 创建时间。
  updated_at timestamptz not null default now() -- 更新时间。
); -- 商家入驻申请表结束。

create table if not exists public.reviewer_profiles ( -- 创建审核员资料表。
  user_id uuid primary key references auth.users(id) on delete cascade, -- 审核员账号编号，来自 Supabase Auth。
  email text not null unique, -- 审核员邮箱。
  role text not null default 'reviewer' check (role in ('reviewer', 'admin')), -- 审核员角色。
  created_at timestamptz not null default now() -- 创建时间。
); -- 审核员资料表结束。

create or replace function public.set_updated_at() -- 创建自动更新时间函数。
returns trigger -- 声明这是触发器函数。
language plpgsql -- 使用 Postgres 的过程语言。
as $$ -- 函数正文开始。
begin -- 函数逻辑开始。
  new.updated_at = now(); -- 每次更新数据时，把更新时间改成当前时间。
  return new; -- 返回更新后的数据。
end; -- 函数逻辑结束。
$$; -- 函数正文结束。

drop trigger if exists merchant_applications_set_updated_at on public.merchant_applications; -- 如果旧触发器存在，先移除。

create trigger merchant_applications_set_updated_at -- 创建商家申请更新时间触发器。
before update on public.merchant_applications -- 在商家申请表更新前执行。
for each row -- 每一行更新都执行。
execute function public.set_updated_at(); -- 执行自动更新时间函数。

create or replace function public.is_reviewer() -- 创建判断当前登录用户是否是审核员的函数。
returns boolean -- 返回 true 或 false。
language sql -- 使用 SQL 写这个函数。
security definer -- 用函数创建者权限查询 reviewer_profiles，避免 RLS 策略递归。
set search_path = public -- 固定搜索路径，避免函数查错表。
as $$ -- 函数正文开始。
  select exists ( -- 查询是否存在匹配的审核员记录。
    select 1 -- 只需要判断存在，不需要取具体字段。
    from public.reviewer_profiles -- 从审核员资料表查询。
    where user_id = auth.uid() -- 当前登录用户的 id 必须在审核员名单里。
  ); -- 存在性查询结束。
$$; -- 函数正文结束。

alter table public.merchant_applications enable row level security; -- 给商家申请表开启行级权限。
alter table public.reviewer_profiles enable row level security; -- 给审核员表开启行级权限。

grant usage on schema public to anon, authenticated; -- 允许匿名用户和登录用户访问 public schema。
grant insert on public.merchant_applications to anon; -- 允许匿名前端提交商家申请。
grant select on public.merchant_applications to anon; -- 允许匿名前端读取已通过商家的公开状态，用来判断钱包是否能进入商家后台。
grant select, update on public.merchant_applications to authenticated; -- 允许登录审核员读取和更新商家申请，最终还会被 RLS 策略限制。
grant select on public.reviewer_profiles to authenticated; -- 允许登录用户读取审核员资料，最终还会被 RLS 策略限制。
grant execute on function public.is_reviewer() to authenticated; -- 允许登录用户执行是否审核员判断函数。

drop policy if exists "anyone can submit merchant applications" on public.merchant_applications; -- 删除旧的商家提交策略，方便重复运行。
drop policy if exists "anyone can read approved merchant applications" on public.merchant_applications; -- 删除旧的已通过商家读取策略，方便重复运行。
drop policy if exists "reviewers can read all merchant applications" on public.merchant_applications; -- 删除旧的审核员读取策略，方便重复运行。
drop policy if exists "reviewers can update review result" on public.merchant_applications; -- 删除旧的审核员更新策略，方便重复运行。
drop policy if exists "reviewers can read reviewer profiles" on public.reviewer_profiles; -- 删除会导致递归的旧审核员读取策略。
drop policy if exists "reviewers can read own reviewer profile" on public.reviewer_profiles; -- 删除新版审核员读取策略，方便重复运行。

create policy "anyone can submit merchant applications" -- 创建公开提交入驻申请策略。
on public.merchant_applications -- 作用在商家申请表。
for insert -- 只允许新增。
to anon -- 匿名前端可以提交。
with check (status = 'pending'); -- 新提交的申请必须是待审核状态。

create policy "anyone can read approved merchant applications" -- 创建公开读取已通过商家的策略。
on public.merchant_applications -- 作用在商家申请表。
for select -- 允许查询。
to anon -- 未登录 Supabase 的网页也可以查询。
using (status = 'approved'); -- 只能看到已经通过审核的商家申请。

create policy "reviewers can read all merchant applications" -- 创建审核员读取全部申请策略。
on public.merchant_applications -- 作用在商家申请表。
for select -- 允许查询。
to authenticated -- 只允许已登录用户。
using (public.is_reviewer()); -- 只有审核员名单里的登录用户可以查询。

create policy "reviewers can update review result" -- 创建审核员更新审核结果策略。
on public.merchant_applications -- 作用在商家申请表。
for update -- 允许更新。
to authenticated -- 只允许已登录用户。
using (public.is_reviewer()) -- 只有审核员可以更新已有申请。
with check (public.is_reviewer()); -- 更新后的数据也必须由审核员写入。

create policy "reviewers can read own reviewer profile" -- 创建审核员读取自己资料的策略。
on public.reviewer_profiles -- 作用在审核员资料表。
for select -- 允许查询。
to authenticated -- 只允许已登录用户。
using (user_id = auth.uid()); -- 只允许读取自己的审核员资料，避免查询本表导致递归。

create table if not exists public.room_types ( -- 创建房型表，房型属于链外数据，不直接写进酒店合约。
  id uuid primary key default gen_random_uuid(), -- 房型编号，由数据库自动生成。
  merchant_application_id uuid not null references public.merchant_applications(id) on delete cascade, -- 关联已审核商家的入驻申请。
  owner_wallet text not null, -- 商家钱包地址，用来按钱包读取自己的房型。
  hotel_id text not null, -- 酒店编号，MVP 阶段对应前端本地酒店列表。
  name text not null, -- 房型名称，例如湖景大床房。
  description text not null default '', -- 房型详情描述。
  image_url text not null default '', -- 房型主图链接；图片文件后续放 Supabase Storage。
  gallery_urls text[] not null default '{}', -- 房型图片组链接。
  price numeric not null check (price >= 0), -- 房型价格，不能小于 0。
  currency text not null check (currency in ('MON')), -- 收款币种，MVP 阶段只允许 MON。
  valid_until date not null, -- 房型价格和库存规则有效期。
  total_inventory integer not null check (total_inventory >= 0), -- 总库存，不能小于 0。
  booked_inventory integer not null default 0 check (booked_inventory >= 0), -- 已订库存，不能小于 0。
  area text not null default '', -- 房间面积展示文本。
  bed text not null default '', -- 床型展示文本。
  breakfast text not null default '', -- 早餐展示文本。
  cancellation text not null default '', -- 取消规则展示文本。
  is_active boolean not null default true, -- 是否上架，true 表示用户页面可以看到。
  created_at timestamptz not null default now(), -- 创建时间。
  updated_at timestamptz not null default now(), -- 更新时间。
  constraint room_types_booked_not_over_total check (booked_inventory <= total_inventory) -- 防止已订库存超过总库存。
); -- 房型表创建结束。

drop trigger if exists room_types_set_updated_at on public.room_types; -- 如果旧的房型更新时间触发器存在，就先移除，方便重复执行脚本。
create trigger room_types_set_updated_at -- 创建房型更新时间触发器。
before update on public.room_types -- 在房型表更新之前执行。
for each row -- 每一行更新都执行。
execute function public.set_updated_at(); -- 调用通用更新时间函数。

alter table public.room_types enable row level security; -- 给房型表开启行级权限，RLS 可以理解为数据库里的访问规则。

grant select on public.room_types to anon, authenticated; -- 允许前端读取已上架房型。
grant insert, update on public.room_types to anon; -- MVP 阶段允许前端写入房型，生产版应改为 Edge Function 验签后写入。
grant select, insert, update on public.room_types to authenticated; -- 允许登录用户在 RLS 限制下读写房型。

drop policy if exists "anyone can read active room types" on public.room_types; -- 删除旧的公开读取房型策略，方便重复执行。
drop policy if exists "approved merchants can create room types" on public.room_types; -- 删除旧的商家新增房型策略，方便重复执行。
drop policy if exists "approved merchants can update own room types" on public.room_types; -- 删除旧的商家更新房型策略，方便重复执行。

create policy "anyone can read active room types" -- 创建公开读取已上架房型策略。
on public.room_types -- 策略作用在房型表。
for select -- 允许查询。
to anon, authenticated -- 未登录和已登录用户都可以查。
using (is_active = true); -- 只能读取已上架房型。

create policy "approved merchants can create room types" -- 创建已审核商家新增房型策略。
on public.room_types -- 策略作用在房型表。
for insert -- 允许新增。
to anon, authenticated -- MVP 阶段前端用 anon key 写入。
with check ( -- 新增数据必须满足下面的条件。
  owner_wallet = lower(owner_wallet) -- 钱包地址必须小写，方便稳定匹配。
  and exists ( -- 必须存在对应的已审核商家申请。
    select 1 -- 只判断存在，不读取具体字段。
    from public.merchant_applications -- 从商家申请表检查。
    where merchant_applications.id = room_types.merchant_application_id -- 房型关联的申请编号必须存在。
      and merchant_applications.owner_wallet = room_types.owner_wallet -- 房型钱包必须等于申请钱包。
      and merchant_applications.status = 'approved' -- 申请必须已经审核通过。
  ) -- 已审核商家检查结束。
); -- 新增房型策略结束。

create policy "approved merchants can update own room types" -- 创建已审核商家更新自己房型策略。
on public.room_types -- 策略作用在房型表。
for update -- 允许更新。
to anon, authenticated -- MVP 阶段前端用 anon key 更新。
using ( -- 更新前必须满足下面的条件。
  exists ( -- 必须存在对应的已审核商家申请。
    select 1 -- 只判断存在。
    from public.merchant_applications -- 从商家申请表检查。
    where merchant_applications.id = room_types.merchant_application_id -- 房型关联的申请编号必须匹配。
      and merchant_applications.owner_wallet = room_types.owner_wallet -- 钱包必须匹配。
      and merchant_applications.status = 'approved' -- 商家必须已审核通过。
  ) -- 更新前检查结束。
) -- using 条件结束。
with check ( -- 更新后的数据也必须满足下面的条件。
  owner_wallet = lower(owner_wallet) -- 钱包地址必须保持小写。
  and exists ( -- 更新后仍然必须属于已审核商家。
    select 1 -- 只判断存在。
    from public.merchant_applications -- 从商家申请表检查。
    where merchant_applications.id = room_types.merchant_application_id -- 房型关联申请编号必须匹配。
      and merchant_applications.owner_wallet = room_types.owner_wallet -- 钱包必须匹配。
      and merchant_applications.status = 'approved' -- 商家必须已审核通过。
  ) -- 更新后检查结束。
); -- 更新房型策略结束。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) -- 创建或更新房型图片 bucket，bucket 可以理解为文件仓库。
values ('room-images', 'room-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']) -- bucket 公开读取，单文件限制 5MB，只允许常见图片类型。
on conflict (id) do update -- 如果 bucket 已经存在，就更新它的配置，方便重复执行脚本。
set public = excluded.public, -- 保持公开读取，这样用户页面可以直接显示房型图片。
    file_size_limit = excluded.file_size_limit, -- 更新文件大小限制。
    allowed_mime_types = excluded.allowed_mime_types; -- 更新允许上传的图片类型。

drop policy if exists "anyone can read room images" on storage.objects; -- 删除旧的公开读取图片策略，方便重复执行脚本。
drop policy if exists "approved merchants can upload room images" on storage.objects; -- 删除旧的上传图片策略，方便重复执行脚本。
drop policy if exists "approved merchants can overwrite room images" on storage.objects; -- 删除旧的覆盖图片策略，方便重复执行脚本。

create policy "anyone can read room images" -- 创建公开读取房型图片策略。
on storage.objects -- 策略作用在 Supabase Storage 文件对象表。
for select -- 允许读取文件。
to anon, authenticated -- 未登录和已登录用户都可以读取图片。
using (bucket_id = 'room-images'); -- 只能读取 room-images 这个 bucket 里的文件。

create policy "approved merchants can upload room images" -- 创建商家上传房型图片策略。
on storage.objects -- 策略作用在 Supabase Storage 文件对象表。
for insert -- 允许新增文件。
to anon, authenticated -- MVP 阶段前端使用 anon key 上传。
with check (bucket_id = 'room-images' and (storage.foldername(name))[1] = 'rooms'); -- 只允许上传到 room-images/rooms 路径下。

create policy "approved merchants can overwrite room images" -- 创建商家覆盖同名房型图片策略。
on storage.objects -- 策略作用在 Supabase Storage 文件对象表。
for update -- 允许覆盖文件。
to anon, authenticated -- MVP 阶段前端使用 anon key 覆盖。
using (bucket_id = 'room-images' and (storage.foldername(name))[1] = 'rooms') -- 更新前文件必须在指定 bucket 和路径下。
with check (bucket_id = 'room-images' and (storage.foldername(name))[1] = 'rooms'); -- 更新后文件也必须在指定 bucket 和路径下。
alter table public.room_types add column if not exists merchant_name text not null default ''; -- 给房型表补充商家酒店名称，用户侧酒店列表会从真实房型生成。
