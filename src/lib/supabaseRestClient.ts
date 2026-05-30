export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined; // 从环境变量读取 Supabase 项目地址。

export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined; // 从环境变量读取 Supabase 匿名公钥。

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey); // 判断 Supabase 是否已经配置。

export interface SupabaseAuthSession { // 定义审核员登录会话。
  access_token: string; // 登录后得到的访问令牌。
  user: { id: string; email?: string }; // 登录用户资料。
} // 登录会话定义结束。

const reviewerSessionKey = "monad_hotel_reviewer_session"; // 定义浏览器本地保存审核员会话的键名。

export function requireSupabaseConfig() { // 定义检查 Supabase 配置的函数。
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase 尚未配置，请在 .env.local 填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。"); // 如果缺少配置就报错。
  return { supabaseUrl, supabaseAnonKey }; // 返回配置。
} // 检查配置函数结束。

export function saveReviewerSession(session: SupabaseAuthSession) { // 定义保存审核员会话的函数。
  localStorage.setItem(reviewerSessionKey, JSON.stringify(session)); // 把会话保存到浏览器本地。
} // 保存会话函数结束。

export function readReviewerSession() { // 定义读取审核员会话的函数。
  const raw = localStorage.getItem(reviewerSessionKey); // 读取本地保存的字符串。
  return raw ? JSON.parse(raw) as SupabaseAuthSession : null; // 有内容就转对象，没有就返回空。
} // 读取会话函数结束。

export function clearReviewerSession() { // 定义清除审核员会话的函数。
  localStorage.removeItem(reviewerSessionKey); // 删除本地会话。
} // 清除会话函数结束。

export function publicHeaders() { // 定义匿名请求头。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  return { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}`, "Content-Type": "application/json" }; // 返回匿名请求头。
} // 匿名请求头函数结束。

export function reviewerHeaders() { // 定义审核员请求头。
  const config = requireSupabaseConfig(); // 获取 Supabase 配置。
  const session = readReviewerSession(); // 读取审核员会话。
  if (!session) throw new Error("审核员尚未登录。"); // 没有登录就报错。
  return { apikey: config.supabaseAnonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }; // 返回审核员请求头。
} // 审核员请求头函数结束。
