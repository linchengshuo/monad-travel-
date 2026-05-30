import type { RoomDetailData } from "../data/hotelData"; // 引入前端已经使用的房型展示结构，避免页面里出现两套房型格式。
import type { PaymentToken } from "./booking"; // 引入支付币种类型，保证币种只能是 MON。

export interface RoomTypeRecord { // 定义 Supabase 数据库里 room_types 表的一行数据。
  id: string; // 房型编号，由 Supabase 自动生成 UUID。
  merchant_application_id: string; // 商家入驻申请编号，用来证明这个房型属于哪个已审核商家。
  merchant_name: string; // 商家或酒店名称，用来在用户侧生成真实酒店卡片。
  owner_wallet: string; // 商家钱包地址，用来让商家后台只读取自己的房型。
  hotel_id: string; // 酒店编号，MVP 阶段先绑定到本地酒店列表中的某一家酒店。
  hotel_contract_address: string; // 酒店链上合约地址，用户支付时会调用这个合约。
  name: string; // 房型名称，例如“湖景大床房”。
  description: string; // 房型详情，例如面积、景观、适合人群等说明。
  image_url: string; // 房型主图地址；数据库保存链接，图片文件后续放 Supabase Storage。
  gallery_urls: string[]; // 房型图片组，后续可以展示多张图片。
  price: number; // 房型价格，MVP 阶段用普通数字表示。
  currency: PaymentToken; // 收款币种，MVP 阶段只允许 MON。
  valid_until: string; // 房型价格和库存规则的有效期。
  total_inventory: number; // 总库存，也就是这个房型总共有多少间。
  booked_inventory: number; // 已订库存，也就是已经被订单占用多少间。
  area: string; // 面积展示文本，例如“38 平方米”。
  bed: string; // 床型展示文本，例如“1 张 1.8 米大床”。
  breakfast: string; // 早餐展示文本，例如“含双早”。
  cancellation: string; // 取消规则展示文本，例如“入住前 24 小时可取消”。
  is_active: boolean; // 是否上架，true 表示用户页面可以看到。
  created_at: string; // 创建时间，由 Supabase 自动生成。
  updated_at: string; // 更新时间，由 Supabase 自动生成。
} // Supabase 房型记录定义结束。

export type RoomTypeInput = Omit<RoomTypeRecord, "id" | "created_at" | "updated_at">; // 定义新增房型时需要提交的数据，排除数据库自动生成的字段。

export type RoomFormState = { // 定义商家后台表单在页面里保存的数据结构。
  name: string; // 房型名称输入值。
  description: string; // 房型详情输入值。
  imageUrl: string; // 房型图片链接输入值。
  price: number; // 房型价格输入值。
  currency: PaymentToken; // 房型收款币种输入值，MVP 阶段固定为 MON。
  validUntil: string; // 房型有效期输入值。
  totalInventory: number; // 房型总库存输入值。
  area: string; // 房型面积输入值。
  bed: string; // 房型床型输入值。
  breakfast: string; // 房型早餐输入值。
  cancellation: string; // 房型取消规则输入值。
}; // 商家后台房型表单定义结束。

export function roomRecordToDetail(record: RoomTypeRecord): RoomDetailData { // 把数据库字段转换成前端展示字段。
  return { // 返回页面已经认识的房型对象。
    id: record.id, // 使用数据库房型编号作为页面房型编号。
    hotelId: record.hotel_id, // 把数据库 hotel_id 转成前端 hotelId。
    name: record.name, // 复制房型名称。
    imageUrl: record.image_url, // 把数据库 image_url 转成前端 imageUrl。
    gallery: record.gallery_urls, // 把数据库图片组复制给前端。
    price: Number(record.price), // 把价格转成数字，避免数据库 numeric 返回字符串时影响计算。
    currency: record.currency, // 复制币种。
    validUntil: record.valid_until, // 把数据库 valid_until 转成前端 validUntil。
    totalInventory: record.total_inventory, // 复制总库存。
    bookedInventory: record.booked_inventory, // 复制已订库存。
    area: record.area, // 复制面积。
    bed: record.bed, // 复制床型。
    breakfast: record.breakfast, // 复制早餐信息。
    cancellation: record.cancellation, // 复制取消规则。
    description: record.description, // 复制详情描述。
  }; // 房型对象返回结束。
} // 数据库房型转换函数结束。
