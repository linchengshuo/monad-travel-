import { requireSupabaseConfig, supabaseAnonKey } from "./supabaseRestClient"; // 引入 Supabase 配置和 anon public key，前端只能使用公开匿名 key。

const roomImageBucket = "room-images"; // 定义房型图片 bucket 名称，bucket 可以理解为 Supabase Storage 里的文件夹仓库。

export function isRoomImageStorageUrl(imageUrl: string) { // 定义判断图片链接是否来自当前房型 Storage 桶的函数。
  const config = requireSupabaseConfig(); // 读取 Supabase 项目地址，避免把别的网站图片误认为商家上传图片。
  const publicPrefix = `${config.supabaseUrl}/storage/v1/object/public/${roomImageBucket}/`; // 拼出当前项目房型图片的公开访问前缀。
  return imageUrl.startsWith(publicPrefix); // 只有以这个前缀开头的图片，才算真正上传到了 Supabase Storage。
} // Storage 图片链接判断函数结束。

function getStorageHeaders(contentType: string) { // 定义上传文件时使用的请求头函数。
  const config = requireSupabaseConfig(); // 检查 Supabase URL 和 anon key 是否存在。
  return { // 返回 Supabase Storage 上传需要的请求头。
    apikey: config.supabaseAnonKey, // 放入 anon public key，证明这是当前 Supabase 项目的请求。
    Authorization: `Bearer ${config.supabaseAnonKey}`, // 放入 Bearer token，Supabase 用它套用 RLS 权限规则。
    "Content-Type": contentType, // 告诉 Supabase 这个文件的 MIME 类型，例如 image/png。
    "x-upsert": "true", // 如果同名文件已存在，就覆盖它，避免重复上传时报错。
  }; // 请求头对象结束。
} // 上传请求头函数结束。

function safeFileName(fileName: string) { // 定义清理文件名的函数，避免中文空格等字符造成路径问题。
  return fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-"); // 只保留小写字母、数字和点，其余替换成短横线。
} // 文件名清理函数结束。

function encodeStoragePath(path: string) { // 定义编码 Storage 路径的函数。
  return path.split("/").map((part) => encodeURIComponent(part)).join("/"); // 逐段编码路径，保留斜杠结构。
} // Storage 路径编码函数结束。

async function parseStorageResponse(response: Response) { // 定义解析 Supabase Storage 响应的函数。
  const text = await response.text(); // 先读取响应文本，因为错误时 Supabase 会返回 JSON 文本。
  const body = text ? JSON.parse(text) : null; // 有内容就转成 JSON，没有内容就保持空值。
  if (!response.ok && (body?.message === "Bucket not found" || body?.error === "Bucket not found")) throw new Error("Supabase Storage 没有 room-images bucket。请在 Supabase SQL Editor 执行 supabase/fix-room-images-bucket.sql。"); // 如果 bucket 不存在，就给出明确修复脚本。
  if (!response.ok) throw new Error(body?.message ?? body?.error ?? "Supabase Storage 上传失败。"); // 如果上传失败，就抛出可读错误。
  return body as { Key?: string; Id?: string }; // 返回 Supabase 上传成功后的简要信息。
} // Storage 响应解析函数结束。

export async function uploadRoomImage(file: File, ownerWallet: string) { // 定义上传房型图片的函数。
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件。"); // 如果不是图片，就拒绝上传。
  const config = requireSupabaseConfig(); // 读取 Supabase 项目地址和 anon key。
  const walletFolder = ownerWallet.toLowerCase(); // 把钱包地址转成小写，作为商家的文件夹名。
  const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`; // 生成唯一前缀，避免不同图片文件重名。
  const objectPath = `rooms/${walletFolder}/${uniquePrefix}-${safeFileName(file.name)}`; // 拼出 Storage 内部文件路径。
  const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${roomImageBucket}/${encodeStoragePath(objectPath)}`; // 拼出 Supabase Storage 上传地址。
  const response = await fetch(uploadUrl, { method: "POST", headers: getStorageHeaders(file.type || "application/octet-stream"), body: file }); // 把浏览器选择的文件直接上传到 Supabase。
  await parseStorageResponse(response); // 检查上传结果是否成功。
  return `${config.supabaseUrl}/storage/v1/object/public/${roomImageBucket}/${encodeStoragePath(objectPath)}`; // 返回公开访问 URL，前端图片标签会使用它。
} // 上传房型图片函数结束。

export function hasStorageUploadConfig() { // 定义判断 Storage 上传配置是否存在的函数。
  return Boolean(supabaseAnonKey); // 只要 anon public key 存在，前端就能按 RLS 尝试上传。
} // Storage 配置判断函数结束。
