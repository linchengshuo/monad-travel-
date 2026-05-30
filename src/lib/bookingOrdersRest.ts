import type { BookingRecord } from "../types/booking"; // 引入订单类型，保证数据库读写字段和页面订单一致。
import { publicHeaders, requireSupabaseConfig } from "./supabaseRestClient"; // 引入 Supabase REST 请求工具。

type BookingOrderRow = { // 定义 Supabase booking_orders 表的一行数据。
  id: string; // 链外订单编号。
  hotel_id: string; // 酒店编号。
  room_type_id: string; // 房型编号。
  wallet_address: string; // 下单用户钱包地址。
  guest_hash: string; // 用户资料哈希。
  status: BookingRecord["status"]; // 订单状态。
  qr_payload: string; // 二维码内容。
  payment_token: BookingRecord["paymentToken"]; // 支付币种，MVP 固定 MON。
  payment_amount: number; // 支付金额。
  chain_booking_id: string; // 链上订单 ID。
  offchain_order_hash: string; // 链外订单编号哈希。
  check_in_code: string; // 入住数字密码。
  check_in_code_hash: string; // 入住数字密码哈希。
  hotel_contract_address: string; // 酒店合约地址。
  payment_tx_hash: string | null; // 支付交易哈希。
  check_in_signature: string | null; // 用户到店签名。
  check_in_tx_hash: string | null; // 商家提交入住核验交易哈希。
  created_at: string; // 订单创建时间。
  source: BookingRecord["source"]; // 订单来源。
}; // Supabase 订单行定义结束。

async function parseResponse<T>(response: Response) { // 定义解析 Supabase 响应的通用函数。
  const text = await response.text(); // 先读取响应文本。
  const body = text ? JSON.parse(text) : null; // 有文本就解析 JSON，没有文本就返回空。
  if (!response.ok) throw new Error(body?.message ?? body?.hint ?? body?.details ?? "Supabase 订单请求失败。"); // 请求失败时抛出明确错误。
  return body as T; // 返回调用方需要的类型。
} // 响应解析函数结束。

function recordToRow(order: BookingRecord): BookingOrderRow { // 定义把页面订单转成数据库字段的函数。
  return { id: order.id, hotel_id: order.hotelId, room_type_id: order.roomTypeId, wallet_address: order.walletAddress.toLowerCase(), guest_hash: order.guestHash, status: order.status, qr_payload: order.qrPayload, payment_token: order.paymentToken, payment_amount: order.paymentAmount, chain_booking_id: order.chainBookingId, offchain_order_hash: order.offchainOrderHash, check_in_code: order.checkInCode, check_in_code_hash: order.checkInCodeHash, hotel_contract_address: order.hotelContractAddress, payment_tx_hash: order.paymentTxHash ?? null, check_in_signature: order.checkInSignature ?? null, check_in_tx_hash: order.checkInTxHash ?? null, created_at: order.createdAt, source: order.source }; // 返回 Supabase 需要的 snake_case 字段。
} // 页面订单转数据库行函数结束。

function rowToRecord(row: BookingOrderRow): BookingRecord { // 定义把数据库订单转回页面订单的函数。
  return { id: row.id, hotelId: row.hotel_id, roomTypeId: row.room_type_id, walletAddress: row.wallet_address, guestHash: row.guest_hash, status: row.status, qrPayload: row.qr_payload, paymentToken: row.payment_token, paymentAmount: Number(row.payment_amount), chainBookingId: row.chain_booking_id, offchainOrderHash: row.offchain_order_hash, checkInCode: row.check_in_code, checkInCodeHash: row.check_in_code_hash, hotelContractAddress: row.hotel_contract_address, paymentTxHash: row.payment_tx_hash ?? undefined, checkInSignature: row.check_in_signature ?? undefined, checkInTxHash: row.check_in_tx_hash ?? undefined, createdAt: row.created_at, source: row.source }; // 返回页面使用的 camelCase 字段。
} // 数据库行转页面订单函数结束。

export async function upsertBookingOrder(order: BookingRecord) { // 定义新增或覆盖保存订单的函数。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/booking_orders?on_conflict=id`, { method: "POST", headers: { ...publicHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(recordToRow(order)) }); // 使用 upsert 语义写入订单，id 相同就合并。
  await parseResponse<null>(response); // 检查写入是否成功。
} // 保存订单函数结束。

export async function fetchBookingOrdersByWallet(walletAddress: string) { // 定义按用户钱包读取订单的函数。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const query = new URLSearchParams({ select: "*", wallet_address: `eq.${walletAddress.toLowerCase()}`, order: "created_at.desc" }); // 创建查询参数。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/booking_orders?${query.toString()}`, { headers: publicHeaders() }); // 请求用户订单。
  const rows = await parseResponse<BookingOrderRow[]>(response); // 解析数据库订单行。
  return rows.map(rowToRecord); // 转成页面订单后返回。
} // 按钱包读取订单函数结束。

export async function fetchBookingOrdersByHotel(hotelId: string) { // 定义按酒店编号读取订单的函数。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const query = new URLSearchParams({ select: "*", hotel_id: `eq.${hotelId}`, order: "created_at.desc" }); // 创建查询参数。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/booking_orders?${query.toString()}`, { headers: publicHeaders() }); // 请求酒店订单。
  const rows = await parseResponse<BookingOrderRow[]>(response); // 解析数据库订单行。
  return rows.map(rowToRecord); // 转成页面订单后返回。
} // 按酒店读取订单函数结束。
