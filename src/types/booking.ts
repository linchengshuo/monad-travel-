export type PaymentToken = "MON"; // 定义支付币种类型，MVP 阶段只允许 Monad 测试网原生币 MON。

export type MerchantStatus = "draft" | "active"; // 定义商家状态，draft 是草稿，active 是已入驻。

export type BookingStatus = "reserved" | "paid" | "signed" | "checkedIn"; // 定义订单状态，分别表示已预留、已支付、已到店签名、已入住。

export interface HotelProfile { // 定义酒店主体资料，主体会对应一个链上酒店合约。
  id: string; // 酒店在链外系统里的编号。
  contractAddress: string; // 酒店自己的链上合约地址。
  ownerAddress: string; // 酒店商家的钱包地址。
  name: string; // 酒店名称。
  city: string; // 酒店所在城市。
  status: MerchantStatus; // 酒店入驻状态。
} // 酒店主体资料定义结束。

export interface RoomType { // 定义链外保存的房型资料。
  id: string; // 房型编号。
  hotelId: string; // 这个房型属于哪家酒店。
  name: string; // 房型名称。
  imageUrl: string; // 房型图片地址，MVP 阶段先用链接。
  price: number; // 房型价格，MVP 阶段用普通数字展示。
  currency: PaymentToken; // 房型收款币种，MVP 阶段固定为 MON。
  validUntil: string; // 房型有效期。
  totalInventory: number; // 总库存，也就是一共有多少间。
  bookedInventory: number; // 已订库存，也就是已经被订走多少间。
} // 房型资料定义结束。

export interface GuestDraft { // 定义用户准备提交的入住资料。
  fullName: string; // 用户姓名。
  phone: string; // 用户电话。
  identityNumber: string; // 用户身份证或证件号。
} // 用户资料定义结束。

export interface BookingRecord { // 定义订单资料。
  id: string; // 链外订单编号。
  hotelId: string; // 订单属于哪家酒店。
  roomTypeId: string; // 订单选择了哪种房型。
  walletAddress: string; // 下单用户的钱包地址。
  guestHash: string; // 用户资料哈希，哈希可以理解为资料指纹。
  status: BookingStatus; // 订单状态。
  qrPayload: string; // 二维码内容，MVP 阶段用字符串模拟。
  paymentToken: PaymentToken; // 用户支付使用的币种，MVP 阶段固定为 MON。
  paymentAmount: number; // 用户支付的房费数字。
  chainBookingId: string; // 写入酒店合约的订单 ID。
  offchainOrderHash: string; // 链外订单编号的哈希，链上只保存哈希。
  checkInCode: string; // 商家给用户到店核验使用的数字密码。
  checkInCodeHash: string; // 数字密码哈希，链上只保存哈希。
  hotelContractAddress: string; // 订单对应的酒店合约地址。
  paymentTxHash?: string; // 支付交易哈希，有真实上链交易时保存。
  checkInSignature?: string; // 用户到店签名，有签名后保存。
  checkInTxHash?: string; // 商家提交入住核验交易后保存。
  createdAt: string; // 订单创建时间。
  source: "local-preview" | "chain"; // 标记订单来自本地预览还是真实链上交易。
} // 订单资料定义结束。
