-- ============================================================
-- إنشاء صف تلقائي في profiles عند تسجيل حساب جديد في auth.users
-- (بدل ما نعتمد على الموقع إنه يعمل insert بنفسه، ده أضمن ويشتغل
-- حتى لو المستخدم قفل الصفحة قبل ما يكمل)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
