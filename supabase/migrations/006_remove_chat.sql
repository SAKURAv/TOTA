-- ============================================================
-- إلغاء نظام الشات بالكامل: التواصل الفعلي بقى عبر واتساب (wa.me)
-- مباشرة من الموقع والبرنامج، فمفيش داعي نخزن رسائل/مرفقات في
-- Supabase أصلًا — ده أبسط وأوفر في المساحة المجانية.
-- ============================================================

-- 1) إيقاف وحذف مهمة الـ cron اللي كانت بتنضف الشاتات القديمة
select cron.unschedule('purge-expired-chats')
where exists (select 1 from cron.job where jobname = 'purge-expired-chats');

-- 2) حذف عمود الربط بالشات من الأوردرات (كان تجهيز للمستقبل ومفضل فاضي دايمًا)
alter table public.orders drop column if exists chat_id;

-- 3) حذف جداول الشات نفسها (وأي دالة/trigger مرتبطة بيهم)
drop function if exists public.purge_expired_chats();
drop table if exists public.chat_messages;
drop table if exists public.chats;

-- 4) حذف سياسات وbucket مرفقات الشات في storage
drop policy if exists "chat-attachments: owner read" on storage.objects;
drop policy if exists "chat-attachments: owner upload" on storage.objects;
delete from storage.objects where bucket_id = 'chat-attachments';
delete from storage.buckets where id = 'chat-attachments';
