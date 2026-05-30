import { publicHeaders, requireSupabaseConfig } from "./supabaseRestClient"; // 引入 Supabase REST 请求需要的地址和请求头工具。
import type { RoomTypeInput, RoomTypeRecord } from "../types/room"; // 引入房型数据库记录和新增房型输入类型。

async function parseResponse<T>(response: Response) { // 定义解析 Supabase 响应的通用函数。
  const text = await response.text(); // 先读取响应文本，因为 Supabase 有时会返回空内容。
  const body = text ? JSON.parse(text) : null; // 如果有文本就转成 JSON，没有文本就保持空值。
  if (!response.ok && body?.message?.includes("schema cache")) throw new Error("Supabase 还没有识别到 room_types 表。请在 Supabase SQL Editor 运行 supabase/fix-room-types.sql，然后刷新页面。"); // 如果是 schema cache 问题，就给新手可执行的中文提示。
  if (!response.ok) throw new Error(body?.message ?? body?.hint ?? body?.details ?? "Supabase 房型请求失败。"); // 如果请求失败，就把 Supabase 的错误信息抛给页面。
  return body as T; // 把解析后的数据按调用方需要的类型返回。
} // 响应解析函数结束。

export async function fetchActiveRoomTypes() { // 定义读取所有已上架房型的函数，用户页面会调用它。
  const config = requireSupabaseConfig(); // 读取 Supabase 项目地址和 anon key。
  const query = new URLSearchParams({ select: "*", is_active: "eq.true", order: "created_at.desc" }); // 只读取已上架房型，并按创建时间倒序排列。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/room_types?${query.toString()}`, { headers: publicHeaders() }); // 向 Supabase REST 接口发起查询。
  return parseResponse<RoomTypeRecord[]>(response); // 返回房型数组。
} // 读取所有已上架房型函数结束。

export async function fetchRoomTypesByHotel(hotelId: string) { // 定义按酒店读取房型的函数，酒店主页会调用它。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const query = new URLSearchParams({ select: "*", hotel_id: `eq.${hotelId}`, is_active: "eq.true", order: "created_at.desc" }); // 只读取指定酒店的已上架房型。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/room_types?${query.toString()}`, { headers: publicHeaders() }); // 向 Supabase 发起查询。
  return parseResponse<RoomTypeRecord[]>(response); // 返回房型数组。
} // 按酒店读取房型函数结束。

export async function fetchMerchantRoomTypes(ownerWallet: string) { // 定义读取某个商家自己房型的函数，商家后台会调用它。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const query = new URLSearchParams({ select: "*", owner_wallet: `eq.${ownerWallet.toLowerCase()}`, is_active: "eq.true", order: "created_at.desc" }); // 按小写钱包地址读取仍在上架的房型。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/room_types?${query.toString()}`, { headers: publicHeaders() }); // 向 Supabase 发起查询。
  return parseResponse<RoomTypeRecord[]>(response); // 返回商家的房型数组。
} // 读取商家房型函数结束。

export async function createRoomType(input: RoomTypeInput) { // 定义新增房型的函数，商家点击保存时会调用它。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/room_types?select=*`, { // 调用 Supabase REST 新增接口，并要求返回新增后的完整记录。
    method: "POST", // 使用 POST 表示新增数据。
    headers: { ...publicHeaders(), Prefer: "return=representation" }, // 使用 anon key 请求，并要求 Supabase 返回新增记录。
    body: JSON.stringify(input), // 把房型输入对象转换成 JSON 字符串发送给数据库。
  }); // 新增房型请求结束。
  const records = await parseResponse<RoomTypeRecord[]>(response); // 解析 Supabase 返回的新房型数组。
  return records[0]; // 返回第一条新房型记录。
} // 新增房型函数结束。

export async function archiveRoomType(roomId: string, ownerWallet: string) { // 定义商家删除房型的函数；这里是软删除，不是真的删数据库行。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const query = new URLSearchParams({ id: `eq.${roomId}`, owner_wallet: `eq.${ownerWallet.toLowerCase()}`, select: "*" }); // 只允许按房型编号和商家钱包匹配自己的房型。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/room_types?${query.toString()}`, { method: "PATCH", headers: { ...publicHeaders(), Prefer: "return=representation" }, body: JSON.stringify({ is_active: false }) }); // 把房型改为下架状态，用户侧和商家侧都不再显示。
  const records = await parseResponse<RoomTypeRecord[]>(response); // 解析 Supabase 返回的房型数组。
  if (records.length === 0) throw new Error("没有找到可删除的房型，或当前钱包不是这个房型的商家。"); // 如果没有改到任何记录，就提示权限或数据问题。
  return records[0]; // 返回被下架的房型记录。
} // 删除房型函数结束。

export async function increaseBookedInventory(roomId: string, currentBookedInventory: number) { // 定义支付成功后增加已订库存的函数。
  const config = requireSupabaseConfig(); // 读取 Supabase 配置。
  const nextBookedInventory = currentBookedInventory + 1; // 已订库存加 1，表示多卖出一间。
  const query = new URLSearchParams({ id: `eq.${roomId}`, booked_inventory: `eq.${currentBookedInventory}`, select: "*" }); // 用当前库存作为条件，尽量避免两个用户同时覆盖库存。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/room_types?${query.toString()}`, { method: "PATCH", headers: { ...publicHeaders(), Prefer: "return=representation" }, body: JSON.stringify({ booked_inventory: nextBookedInventory }) }); // 写入新的已订库存。
  const records = await parseResponse<RoomTypeRecord[]>(response); // 解析 Supabase 返回的房型数组。
  if (records.length === 0) throw new Error("库存没有更新成功，可能是同一时间有其他用户刚刚预订了这间房型。请刷新页面确认库存。"); // 如果没有更新到记录，就提示并发问题。
  return records[0]; // 返回更新后的房型记录。
} // 增加已订库存函数结束。
