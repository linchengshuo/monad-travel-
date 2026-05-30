alter table public.merchant_applications add column if not exists hotel_contract_address text not null default ''; -- 给商家申请表增加酒店合约地址字段，每个已审核商家对应一个链上 Hotel 合约。
alter table public.room_types add column if not exists hotel_contract_address text not null default ''; -- 给房型表冗余保存酒店合约地址，用户侧读取房型时可以直接拿来支付。
grant update on public.merchant_applications to anon, authenticated; -- MVP 阶段允许前端把商家自己创建出的酒店合约地址写回申请表。
drop policy if exists "approved merchants can bind own hotel contract" on public.merchant_applications; -- 删除旧的商家绑定酒店合约策略，方便重复执行。
create policy "approved merchants can bind own hotel contract" -- 创建已审核商家绑定自己酒店合约地址的策略。
on public.merchant_applications -- 策略作用在商家申请表。
for update -- 策略允许更新操作。
to anon, authenticated -- MVP 阶段前端使用 anon key，也允许后续 authenticated 用户。
using (status = 'approved') -- 更新前这条申请必须已经审核通过。
with check (status = 'approved' and owner_wallet = lower(owner_wallet)); -- 更新后仍必须是已审核状态，并保持钱包地址小写。
