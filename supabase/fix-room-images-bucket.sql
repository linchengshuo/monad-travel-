insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) -- 创建房型图片 bucket，bucket 可以理解为 Supabase Storage 里的文件仓库。
values ('room-images', 'room-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']) -- bucket 名叫 room-images，公开读取，单个文件最多 5MB，只允许常见图片格式。
on conflict (id) do update -- 如果这个 bucket 已经存在，就更新配置，保证脚本可以重复执行。
set public = excluded.public, -- 保持公开读取，否则用户页面无法直接显示图片。
    file_size_limit = excluded.file_size_limit, -- 更新单文件大小限制。
    allowed_mime_types = excluded.allowed_mime_types; -- 更新允许上传的图片类型。

drop policy if exists "anyone can read room images" on storage.objects; -- 删除旧的读取策略，避免重复创建时报错。
drop policy if exists "approved merchants can upload room images" on storage.objects; -- 删除旧的上传策略，避免重复创建时报错。
drop policy if exists "approved merchants can overwrite room images" on storage.objects; -- 删除旧的覆盖策略，避免重复创建时报错。

create policy "anyone can read room images" -- 创建公开读取房型图片策略。
on storage.objects -- 这个策略作用在 Supabase Storage 文件对象表。
for select -- 允许读取文件。
to anon, authenticated -- 未登录用户和已登录用户都可以读取图片。
using (bucket_id = 'room-images'); -- 只允许读取 room-images 这个 bucket 里的文件。

create policy "approved merchants can upload room images" -- 创建上传房型图片策略。
on storage.objects -- 这个策略作用在 Supabase Storage 文件对象表。
for insert -- 允许新增文件。
to anon, authenticated -- 当前 MVP 使用前端 anon key 上传，后续生产版要改成 Edge Function。
with check (bucket_id = 'room-images' and (storage.foldername(name))[1] = 'rooms'); -- 只允许上传到 rooms 目录，避免乱写 Storage。

create policy "approved merchants can overwrite room images" -- 创建覆盖同名房型图片策略。
on storage.objects -- 这个策略作用在 Supabase Storage 文件对象表。
for update -- 允许更新文件。
to anon, authenticated -- 当前 MVP 使用前端 anon key 覆盖，后续生产版要改成 Edge Function。
using (bucket_id = 'room-images' and (storage.foldername(name))[1] = 'rooms') -- 更新前必须是 room-images bucket 的 rooms 目录文件。
with check (bucket_id = 'room-images' and (storage.foldername(name))[1] = 'rooms'); -- 更新后也必须留在 room-images bucket 的 rooms 目录。
