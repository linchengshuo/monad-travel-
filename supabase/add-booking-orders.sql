create table if not exists public.booking_orders ( -- 创建订单表，保存链上支付后的订单凭证，不保存姓名、电话、证件号明文。
  id text primary key, -- 链外订单编号，前端生成并作为主键。
  hotel_id text not null, -- 酒店编号，对应商家申请 id。
  room_type_id uuid not null, -- 房型编号，对应 room_types.id。
  wallet_address text not null, -- 用户下单钱包地址。
  guest_hash text not null, -- 用户资料哈希。
  status text not null check (status in ('reserved', 'paid', 'signed', 'checkedIn')), -- 订单状态，signed 表示用户到店签名已验证。
  qr_payload text not null, -- 二维码内容。
  payment_token text not null default 'MON' check (payment_token in ('MON')), -- 支付币种，MVP 阶段只支持 MON。
  payment_amount numeric not null check (payment_amount >= 0), -- 支付金额。
  chain_booking_id text not null, -- 链上订单 ID。
  offchain_order_hash text not null, -- 链外订单编号哈希。
  check_in_code text not null, -- 入住数字密码，MVP 阶段用于商家扫码核验。
  check_in_code_hash text not null, -- 入住数字密码哈希。
  hotel_contract_address text not null, -- 酒店合约地址。
  payment_tx_hash text, -- 支付交易哈希。
  check_in_signature text, -- 用户到店签名。
  check_in_tx_hash text, -- 商家提交入住核验交易哈希。
  created_at timestamptz not null default now(), -- 订单创建时间。
  source text not null default 'chain' check (source in ('local-preview', 'chain')) -- 订单来源。
); -- 订单表结束。
alter table public.booking_orders enable row level security; -- 开启 RLS 行级权限。
grant select, insert, update on public.booking_orders to anon, authenticated; -- MVP 阶段允许前端读写订单，生产版应改为 Edge Function 验签后写入。
drop policy if exists "anyone can read booking orders" on public.booking_orders; -- 删除旧读取策略，方便重复执行。
drop policy if exists "anyone can insert booking orders" on public.booking_orders; -- 删除旧新增策略，方便重复执行。
drop policy if exists "anyone can update booking orders" on public.booking_orders; -- 删除旧更新策略，方便重复执行。
create policy "anyone can read booking orders" -- 创建订单读取策略。
on public.booking_orders -- 策略作用在订单表。
for select -- 允许查询。
to anon, authenticated -- 匿名前端和登录用户都能查询。
using (true); -- MVP 阶段暂时公开读取订单凭证；订单不含用户资料明文。
create policy "anyone can insert booking orders" -- 创建订单新增策略。
on public.booking_orders -- 策略作用在订单表。
for insert -- 允许新增。
to anon, authenticated -- 匿名前端和登录用户都能新增。
with check (payment_token = 'MON' and wallet_address = lower(wallet_address)); -- 新增订单必须使用 MON，并保持钱包地址小写。
create policy "anyone can update booking orders" -- 创建订单更新策略。
on public.booking_orders -- 策略作用在订单表。
for update -- 允许更新。
to anon, authenticated -- 匿名前端和登录用户都能更新。
using (true) -- MVP 阶段允许读取到的订单被更新。
with check (payment_token = 'MON' and wallet_address = lower(wallet_address)); -- 更新后仍必须使用 MON，并保持钱包地址小写。
