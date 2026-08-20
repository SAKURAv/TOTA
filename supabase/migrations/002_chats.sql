-- ============================================================
-- الشات: شات عام لكل حساب + شات خاص لكل منتج، بعلامات تتحكم
-- في لون الشات في البرنامج، وحذف تلقائي بعد مدة (تتحدد لاحقًا
-- من إعدادات الموقع في البرنامج نفسه)
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'chat_label') then
    create type public.chat_label as enum (
      'new_request',     -- طالب أوردر
      'awaiting_payment',-- لسه لم يتم الدفع
      'paid',            -- تم الدفع
      'issue',           -- فيه مشكلة
      'closed'           -- انتهى
    );
  end if;
end $$;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, -- فاضي = شات عام للحساب
  label public.chat_label not null default 'new_request',
  last_message_at timestamptz not null default now(), -- تُستخدم للترتيب (الأحدث فوق)
  expires_at timestamptz,   -- يُحسب تلقائيًا عند كل رسالة جديدة (تريجر تحت)
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','admin')),
  body text,
  attachment_path text,     -- مسار الملف داخل storage bucket "chat-attachments"
  created_at timestamptz not null default now()
);

-- ربط orders.chat_id بجدول chats بعد ما اتعرّف
alter table public.orders
  add constraint orders_chat_id_fkey
  foreign key (chat_id) references public.chats(id) on delete set null;

create index if not exists idx_chats_user on public.chats(user_id);
create index if not exists idx_chats_last_msg on public.chats(last_message_at desc);
create index if not exists idx_chat_messages_chat on public.chat_messages(chat_id, created_at);

-- ------------------------------------------------------------
-- مدة الاحتفاظ بالشات قبل الحذف التلقائي (بالأيام). قيمة افتراضية
-- 30 يوم، وتقدر تتغيّر لاحقًا من "إعدادات الموقع" في البرنامج
-- من غير ما نلمس أي كود SQL.
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value)
  values ('chat_retention_days', '30')
  on conflict (key) do nothing;

-- كل ما توصل رسالة جديدة، بيتحدث وقت آخر رسالة وتاريخ الانتهاء تلقائيًا
create or replace function public.touch_chat_on_message()
returns trigger language plpgsql as $$
declare
  retention_days int;
begin
  select coalesce((value)::text::int, 30) into retention_days
  from public.app_settings where key = 'chat_retention_days';

  update public.chats
    set last_message_at = now(),
        expires_at = now() + make_interval(days => retention_days)
    where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat on public.chat_messages;
create trigger trg_touch_chat
  after insert on public.chat_messages
  for each row execute function public.touch_chat_on_message();

-- ------------------------------------------------------------
-- دالة الحذف التلقائي للشاتات المنتهية (تُستدعى دوريًا عبر
-- Supabase Cron، مضبوطة في ملف 003_storage_and_cron.sql)
-- بتحذف رسائل الشات ومرفقاته من الـ storage والصفوف من الجدول.
-- ------------------------------------------------------------
create or replace function public.purge_expired_chats()
returns void language plpgsql security definer as $$
declare
  r record;
begin
  for r in
    select id from public.chats where expires_at is not null and expires_at < now()
  loop
    -- حذف المرفقات من storage (اسم الـ bucket: chat-attachments)
    -- الملفات بتتخزن دايمًا داخل مجلد باسم chat_id (مثال:
    -- chat-attachments/<chat_id>/الملف.png) فبنحذف كل حاجة تحت
    -- المجلد ده باستخدام مطابقة بداية المسار (prefix match)
    delete from storage.objects
      where bucket_id = 'chat-attachments'
        and name like (r.id::text || '/%');
    delete from public.chats where id = r.id; -- سيحذف الرسائل تلقائيًا (on delete cascade)
  end loop;
end;
$$;
