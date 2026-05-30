import type { HotelProfile, RoomType } from "../types/booking"; // 引入类型，只用于帮助 TypeScript 检查数据形状。

export const demoHotels: HotelProfile[] = [ // 定义演示酒店列表，之后会换成真实链外数据库。
  { // 第一家酒店开始。
    id: "hotel-hangzhou-001", // 酒店链外编号。
    contractAddress: "部署后显示酒店合约地址", // 酒店合约地址占位，部署后替换。
    ownerAddress: "连接商家钱包后显示", // 商家钱包地址占位。
    name: "西湖链上旅宿", // 酒店名称。
    city: "杭州", // 酒店城市。
    status: "active", // 酒店当前状态。
  }, // 第一家酒店结束。
]; // 演示酒店列表结束。

export const demoRoomTypes: RoomType[] = [ // 定义演示房型列表，房型属于链外数据。
  { // 第一种房型开始。
    id: "room-lake-view", // 房型编号。
    hotelId: "hotel-hangzhou-001", // 关联酒店编号。
    name: "湖景大床房", // 房型名称。
    imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80", // 房型图片链接。
    price: 0.01, // 房型价格，MVP 阶段用小额 MON 方便测试。
    currency: "MON", // 支付币种。
    validUntil: "2026-12-31", // 有效期。
    totalInventory: 12, // 总库存。
    bookedInventory: 4, // 已订库存。
  }, // 第一种房型结束。
  { // 第二种房型开始。
    id: "room-family-suite", // 房型编号。
    hotelId: "hotel-hangzhou-001", // 关联酒店编号。
    name: "家庭套房", // 房型名称。
    imageUrl: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80", // 房型图片链接。
    price: 0.02, // 房型价格，MVP 阶段用小额 MON 方便测试。
    currency: "MON", // 支付币种。
    validUntil: "2026-12-31", // 有效期。
    totalInventory: 6, // 总库存。
    bookedInventory: 2, // 已订库存。
  }, // 第二种房型结束。
]; // 演示房型列表结束。
