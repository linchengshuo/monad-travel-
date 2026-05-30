import { clearReviewerSession, publicHeaders, readReviewerSession, requireSupabaseConfig, reviewerHeaders, saveReviewerSession } from "./supabaseRestClient"; // 引入 Supabase REST 工具。
import type { MerchantApplicationInput, MerchantApplicationRecord, MerchantApplicationStatus } from "../types/merchant"; // 引入商家申请类型。

async function parseResponse<T>(response: Response) { // 定义解析接口响应的函数。
  const text = await response.text(); // 读取响应文本。
  const body = text ? JSON.parse(text) : null; // 如果有内容就转成 JSON。
  if (!response.ok) throw new Error(body?.message ?? body?.error_description ?? body?.hint ?? body?.details ?? "Supabase 请求失败。"); // 如果请求失败就抛出错误。
  return body as T; // 返回指定类型的数据。
} // 解析响应函数结束。

export async function submitMerchantApplication(input: MerchantApplicationInput) { // 定义提交商家入驻申请的函数。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  const now = new Date().toISOString(); // 生成当前时间，作为页面本地展示用的时间。
  const payload = { ...input, status: "pending" }; // 明确告诉数据库这是一条待审核申请，方便通过 RLS 权限检查。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/merchant_applications`, { method: "POST", headers: { ...publicHeaders(), Prefer: "return=minimal" }, body: JSON.stringify(payload) }); // 只要求数据库插入，不要求立刻返回整条记录，避免插入时被读取权限影响。
  await parseResponse<null>(response); // 检查 Supabase 是否成功写入；没有报错就代表插入成功。
  return { ...input, id: crypto.randomUUID(), status: "pending", reviewer_note: "", reviewed_by: null, reviewed_at: null, created_at: now, updated_at: now } as MerchantApplicationRecord; // 返回一条本地展示记录，让页面可以跳转到等待审核页。
} // 提交申请函数结束。

export async function fetchApprovedMerchantByWallet(walletAddress: string) { // 定义按钱包查询已通过商家的函数。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  const query = new URLSearchParams({ select: "id,owner_wallet,company_name,status,created_at,updated_at,hotel_contract_address", owner_wallet: `eq.${walletAddress.toLowerCase()}`, status: "eq.approved", order: "created_at.desc", limit: "1" }); // 创建查询参数，只读取进入商家后台需要的公开字段。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/merchant_applications?${query.toString()}`, { headers: publicHeaders() }); // 发起查询。
  const data = await parseResponse<MerchantApplicationRecord[]>(response); // 解析查询结果。
  return data[0] ?? null; // 返回第一条记录或空。
} // 查询已通过商家函数结束。

export async function updateMerchantHotelContractAddress(applicationId: string, ownerWallet: string, hotelContractAddress: string) { // 定义把酒店合约地址写回商家申请和房型表的函数。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  const wallet = ownerWallet.toLowerCase(); // 把钱包地址转成小写，保持数据库查询稳定。
  const payload = { hotel_contract_address: hotelContractAddress }; // 组织要写入数据库的字段。
  const applicationResponse = await fetch(`${config.supabaseUrl}/rest/v1/merchant_applications?id=eq.${applicationId}&owner_wallet=eq.${wallet}&select=*`, { method: "PATCH", headers: { ...publicHeaders(), Prefer: "return=representation" }, body: JSON.stringify(payload) }); // 更新商家申请记录，让酒店主体保存自己的合约地址。
  const applications = await parseResponse<MerchantApplicationRecord[]>(applicationResponse); // 解析更新后的商家申请。
  const roomsResponse = await fetch(`${config.supabaseUrl}/rest/v1/room_types?merchant_application_id=eq.${applicationId}&owner_wallet=eq.${wallet}`, { method: "PATCH", headers: { ...publicHeaders(), Prefer: "return=minimal" }, body: JSON.stringify(payload) }); // 同步更新这个商家已经上传过的旧房型，避免旧房型继续没有合约地址。
  await parseResponse<null>(roomsResponse); // 检查房型同步是否成功。
  return applications[0]; // 返回更新后的商家申请记录。
} // 写回酒店合约地址函数结束。

export async function fetchMerchantApplications() { // 定义审核员查询全部申请的函数。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/merchant_applications?select=*&order=created_at.desc`, { headers: reviewerHeaders() }); // 用审核员身份查询申请。
  return parseResponse<MerchantApplicationRecord[]>(response); // 返回申请列表。
} // 查询申请列表函数结束。

export async function updateMerchantApplicationStatus(id: string, status: MerchantApplicationStatus, reviewerNote: string) { // 定义更新审核状态的函数。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  const session = readReviewerSession(); // 读取审核员会话。
  if (!session) throw new Error("审核员尚未登录。"); // 没有登录就报错。
  const payload = { status, reviewer_note: reviewerNote, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() }; // 组织更新内容。
  const response = await fetch(`${config.supabaseUrl}/rest/v1/merchant_applications?id=eq.${id}&select=*`, { method: "PATCH", headers: { ...reviewerHeaders(), Prefer: "return=representation" }, body: JSON.stringify(payload) }); // 更新审核结果。
  const data = await parseResponse<MerchantApplicationRecord[]>(response); // 解析更新结果。
  return data[0]; // 返回更新后的记录。
} // 更新审核状态函数结束。

export async function signInReviewer(email: string, password: string) { // 定义审核员登录函数。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: publicHeaders(), body: JSON.stringify({ email, password }) }); // 调用 Supabase Auth 邮箱密码登录接口。
  const session = await parseResponse<{ access_token: string; user: { id: string; email?: string } }>(response); // 解析登录会话。
  saveReviewerSession(session); // 保存审核员会话。
} // 审核员登录函数结束。

export async function signOutReviewer() { // 定义审核员退出登录函数。
  clearReviewerSession(); // 清除本地审核员会话。
} // 退出登录函数结束。
