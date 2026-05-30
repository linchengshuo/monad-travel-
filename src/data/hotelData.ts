import type { PaymentToken } from "../types/booking"; // 引入支付币种类型，保证币种只能写成 MON。

const hangzhouHotelContractAddress = import.meta.env.VITE_HOTEL_HANGZHOU_CONTRACT_ADDRESS ?? "未配置酒店合约地址"; // 从环境变量读取杭州演示酒店合约地址。

const shanghaiHotelContractAddress = import.meta.env.VITE_HOTEL_SHANGHAI_CONTRACT_ADDRESS ?? "未配置酒店合约地址"; // 从环境变量读取上海演示酒店合约地址。

const chengduHotelContractAddress = import.meta.env.VITE_HOTEL_CHENGDU_CONTRACT_ADDRESS ?? "未配置酒店合约地址"; // 从环境变量读取成都演示酒店合约地址。

const sanyaHotelContractAddress = import.meta.env.VITE_HOTEL_SANYA_CONTRACT_ADDRESS ?? "未配置酒店合约地址"; // 从环境变量读取三亚演示酒店合约地址。

export interface HotelCardData { // 定义酒店卡片数据结构，结构可以理解为一张表要有哪些列。
  id: string; // 酒店编号，用来跳转到酒店主页。
  name: string; // 酒店名称，用来给用户识别。
  city: string; // 酒店所在城市，用来做筛选和展示。
  district: string; // 酒店所在区域，用来帮助用户判断位置。
  coverImage: string; // 酒店封面图，用来显示酒店外观或房间氛围。
  contractAddress: string; // 酒店链上合约地址，部署前先用占位文字。
  rating: number; // 酒店评分，用来帮助用户快速比较。
  summary: string; // 酒店简介，用来告诉用户酒店特色。
  tags: string[]; // 酒店标签，用来展示设施和卖点。
} // 酒店卡片数据结构结束。

export interface RoomDetailData { // 定义房型详情数据结构。
  id: string; // 房型编号，用来跳转到房型详情。
  hotelId: string; // 关联酒店编号，用来知道这个房型属于哪家酒店。
  name: string; // 房型名称，用来展示给用户和商家。
  imageUrl: string; // 房型图片地址，MVP 阶段先使用图片链接。
  gallery: string[]; // 房型图片组，用来展示多个角度。
  price: number; // 房型价格，MVP 阶段用普通数字展示。
  currency: PaymentToken; // 支付币种，MVP 阶段只允许 MON。
  validUntil: string; // 有效期，表示这个房型价格或库存规则到哪天有效。
  totalInventory: number; // 总库存，也就是商家上传的一共多少间。
  bookedInventory: number; // 已订库存，也就是已经被订单占用多少间。
  area: string; // 房间面积，用来给用户判断空间大小。
  bed: string; // 床型，用来展示房间配置。
  breakfast: string; // 早餐信息，用来展示是否含早。
  cancellation: string; // 取消规则，用来说明退订限制。
  description: string; // 房型详情描述，用来说明房间卖点。
} // 房型详情数据结构结束。

export const hotels: HotelCardData[] = [ // 定义酒店列表，用户首页会看到很多酒店。
  { // 第一家酒店开始。
    id: "hotel-hangzhou-001", // 设置酒店编号。
    name: "西湖链上旅宿", // 设置酒店名称。
    city: "杭州", // 设置城市。
    district: "西湖区", // 设置区域。
    coverImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80", // 设置酒店封面图。
    contractAddress: hangzhouHotelContractAddress, // 设置酒店合约地址。
    rating: 4.8, // 设置评分。
    summary: "靠近湖滨步行区，适合周末度假和商务短住。", // 设置简介。
    tags: ["湖景", "近地铁", "MON 支付"], // 设置标签。
  }, // 第一家酒店结束。
  { // 第二家酒店开始。
    id: "hotel-shanghai-002", // 设置酒店编号。
    name: "外滩签名酒店", // 设置酒店名称。
    city: "上海", // 设置城市。
    district: "黄浦区", // 设置区域。
    coverImage: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80", // 设置酒店封面图。
    contractAddress: shanghaiHotelContractAddress, // 设置酒店合约地址。
    rating: 4.7, // 设置评分。
    summary: "面向商务旅客的高效率入住酒店，到店签名即可核验订单。", // 设置简介。
    tags: ["江景", "商务", "MON 支付"], // 设置标签。
  }, // 第二家酒店结束。
  { // 第三家酒店开始。
    id: "hotel-chengdu-003", // 设置酒店编号。
    name: "成都慢住花园酒店", // 设置酒店名称。
    city: "成都", // 设置城市。
    district: "锦江区", // 设置区域。
    coverImage: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80", // 设置酒店封面图。
    contractAddress: chengduHotelContractAddress, // 设置酒店合约地址。
    rating: 4.6, // 设置评分。
    summary: "适合亲子和长住，房型库存由商家后台链外管理。", // 设置简介。
    tags: ["亲子", "花园", "长住"], // 设置标签。
  }, // 第三家酒店结束。
  { // 第四家酒店开始。
    id: "hotel-sanya-004", // 设置酒店编号。
    name: "三亚海岸度假公寓", // 设置酒店名称。
    city: "三亚", // 设置城市。
    district: "海棠区", // 设置区域。
    coverImage: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1400&q=80", // 设置酒店封面图。
    contractAddress: sanyaHotelContractAddress, // 设置酒店合约地址。
    rating: 4.9, // 设置评分。
    summary: "海边度假房源，适合用链上订单凭证做快速核验。", // 设置简介。
    tags: ["海景", "度假", "家庭"], // 设置标签。
  }, // 第四家酒店结束。
]; // 酒店列表结束。

export const rooms: RoomDetailData[] = [ // 定义房型列表，房型属于链外数据。
  { // 第一种房型开始。
    id: "room-lake-view", // 设置房型编号。
    hotelId: "hotel-hangzhou-001", // 关联杭州酒店。
    name: "湖景大床房", // 设置房型名称。
    imageUrl: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80", // 设置主图。
    gallery: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80", "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1400&q=80"], // 设置图片组。
    price: 0.01, // 设置价格，MVP 阶段用小额 MON 方便测试。
    currency: "MON", // 设置币种。
    validUntil: "2026-12-31", // 设置有效期。
    totalInventory: 12, // 设置总库存。
    bookedInventory: 4, // 设置已订库存。
    area: "38 平方米", // 设置面积。
    bed: "1 张 1.8 米大床", // 设置床型。
    breakfast: "含双早", // 设置早餐。
    cancellation: "入住前 24 小时可取消", // 设置取消规则。
    description: "房间面向湖滨方向，适合两人短住；用户资料只生成哈希，订单凭证写入酒店合约。", // 设置描述。
  }, // 第一种房型结束。
  { // 第二种房型开始。
    id: "room-family-suite", // 设置房型编号。
    hotelId: "hotel-hangzhou-001", // 关联杭州酒店。
    name: "家庭套房", // 设置房型名称。
    imageUrl: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=80", // 设置主图。
    gallery: ["https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=80", "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1400&q=80"], // 设置图片组。
    price: 0.02, // 设置价格，MVP 阶段用小额 MON 方便测试。
    currency: "MON", // 设置币种。
    validUntil: "2026-12-31", // 设置有效期。
    totalInventory: 6, // 设置总库存。
    bookedInventory: 2, // 设置已订库存。
    area: "62 平方米", // 设置面积。
    bed: "1 张大床 + 1 张单人床", // 设置床型。
    breakfast: "含三早", // 设置早餐。
    cancellation: "入住前 48 小时可取消", // 设置取消规则。
    description: "适合家庭入住，链外库存会在真实版本中先锁定，再等待链上支付确认。", // 设置描述。
  }, // 第二种房型结束。
  { // 第三种房型开始。
    id: "room-bund-business", // 设置房型编号。
    hotelId: "hotel-shanghai-002", // 关联上海酒店。
    name: "商务江景房", // 设置房型名称。
    imageUrl: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1400&q=80", // 设置主图。
    gallery: ["https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1400&q=80"], // 设置图片组。
    price: 0.015, // 设置价格，MVP 阶段用小额 MON 方便测试。
    currency: "MON", // 设置币种。
    validUntil: "2026-10-31", // 设置有效期。
    totalInventory: 18, // 设置总库存。
    bookedInventory: 9, // 设置已订库存。
    area: "32 平方米", // 设置面积。
    bed: "1 张 1.5 米大床", // 设置床型。
    breakfast: "含单早", // 设置早餐。
    cancellation: "不可取消", // 设置取消规则。
    description: "适合商务差旅，到店通过二维码和钱包签名完成身份核验。", // 设置描述。
  }, // 第三种房型结束。
  { // 第四种房型开始。
    id: "room-sanya-sea", // 设置房型编号。
    hotelId: "hotel-sanya-004", // 关联三亚酒店。
    name: "海景双卧套房", // 设置房型名称。
    imageUrl: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1400&q=80", // 设置主图。
    gallery: ["https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1400&q=80"], // 设置图片组。
    price: 0.025, // 设置价格，MVP 阶段用小额 MON 方便测试。
    currency: "MON", // 设置币种。
    validUntil: "2026-09-30", // 设置有效期。
    totalInventory: 10, // 设置总库存。
    bookedInventory: 3, // 设置已订库存。
    area: "88 平方米", // 设置面积。
    bed: "2 间卧室", // 设置床型。
    breakfast: "不含早", // 设置早餐。
    cancellation: "入住前 72 小时可取消", // 设置取消规则。
    description: "面向多人度假场景，商家后台可维护图片、详情、价格和库存。", // 设置描述。
  }, // 第四种房型结束。
]; // 房型列表结束。
