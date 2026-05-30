# Supabase 数据库设置

## 为什么选 Supabase

Supabase 适合这个阶段，因为它同时提供：

- Postgres 数据库：保存商家入驻申请。
- Auth 登录：审核人员用邮箱和密码登录。
- Row Level Security：控制谁能看、谁能改申请。
- Storage：后续可保存营业执照、经营许可、房型图片。

## 你需要创建的环境变量

在项目根目录新建 `.env.local`，内容如下：

```bash
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

不要把 `.env.local` 提交到 Git。

绝对不要把 `service_role key` 写进前端项目。  
`service_role key` 权限极高，只能放在后端或 Supabase Edge Function 里。

## 建表步骤

1. 打开 Supabase 项目后台。
2. 进入 SQL Editor。
3. 复制 `supabase/schema.sql` 的全部内容。
4. 执行 SQL。

## 创建审核员

1. 进入 Supabase Authentication。
2. 创建一个审核员用户，例如 `reviewer@example.com`。
3. 复制这个用户的 `user_id`。
4. 在 SQL Editor 执行：

```sql
insert into public.reviewer_profiles (user_id, email, role)
values ('这里替换成审核员 user_id', 'reviewer@example.com', 'reviewer');
```

## 审核网址

本地开发时：

```text
http://127.0.0.1:5173/audit
```

审核人员登录后可以看到商家入驻申请，并点击通过或拒绝。

## 当前 MVP 的限制

- 商家提交入驻资料时使用 Supabase anon key + RLS 写入数据库。
- 审核查看和审核更新必须登录审核员账号。
- 资质文件当前先填写链接，后续再接 Supabase Storage 文件上传。
- 更强的生产方案是：商家钱包签名后，把申请交给 Supabase Edge Function，由后端验证签名后写库。

## 房型表和图片处理

这次新增了 `room_types` 表，用来保存商家后台上传的房型资料。

你需要重新执行一次 `supabase/schema.sql`，否则前端保存房型时会提示找不到 `room_types` 表。

当前阶段数据库保存的是 `image_url`，也就是图片链接。真正的图片文件不应该直接塞进数据库；正确做法是放进 Supabase Storage，然后把 Storage 返回的公开链接写入 `room_types.image_url`。

当前 MVP 为了让流程先跑通，商家后台先填写图片链接。下一步再接 Supabase Storage 文件上传。

安全提醒：当前房型写入使用前端 anon key + RLS 做最小限制。生产版本必须改成“钱包签名 -> Supabase Edge Function 验签 -> 后端写库”，否则别人有可能伪造前端请求。
## Supabase Storage 房型图片

这次新增了 `room-images` bucket，用来保存商家上传的房型图片。

你需要重新执行一次 `supabase/schema.sql`，它会自动创建 `room-images` bucket 和对应的 Storage 权限策略。

上传后的图片文件会放在 `room-images/rooms/商家钱包地址/文件名` 路径下。

数据库 `room_types.image_url` 只保存图片公开链接，不保存图片二进制文件。

当前 MVP 使用前端 anon key 直接上传到 Storage；生产版本必须改成钱包签名后交给 Supabase Edge Function 验签再上传。
