alter table public.room_types drop constraint if exists room_types_currency_check; -- 删除旧的 USDC/USDT 币种限制，否则数据库会拒绝保存 MON 房型。
update public.merchant_applications set hotel_contract_address = ''; -- 清空旧酒店合约地址，因为旧合约不支持 MON 原生支付。
update public.room_types set hotel_contract_address = ''; -- 清空旧房型里的酒店合约地址，要求商家用新 Factory 重新创建 MON 版酒店合约。
update public.room_types set currency = 'MON' where currency in ('USDC', 'USDT'); -- 把已有测试房型统一改成 MON，避免旧数据继续触发前端支付问题。
update public.room_types set price = 0.01 where currency = 'MON' and price > 1; -- 把旧 USDC/USDT 价格临时降成 0.01 MON，避免 MVP 测试时金额过大。
alter table public.room_types add constraint room_types_currency_check check (currency in ('MON')); -- 新增只允许 MON 的币种限制，符合当前 MVP 支付方案。
