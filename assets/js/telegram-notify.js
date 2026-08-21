// ============================================================
//  إشعار تليجرام فوري — بيستدعي Edge Function اسمها notify-telegram
//  مباشرة من هنا (بعد ما أي عملية مهمة تنجح فعليًا في قاعدة البيانات)
//  بدل ما يعتمد على Database Webhook.
//
//  ليه التغيير ده: الـ Webhook محتاج سكيما internal اسمها
//  supabase_functions موجودة تلقائيًا في كل مشروع Supabase، ولو
//  المشروع اتعمل وهي مش موجودة (مشكلة إعداد من ناحية Supabase نفسها)
//  الـ Webhook بيفشل يتعمل خالص ومفيش رسايل توصل. الاستدعاء المباشر ده
//  بيشتغل بغض النظر، لأنه مش محتاج الـ Webhook أو السكيما دي إطلاقًا —
//  بيكلم الفنكشن زي أي طلب HTTP عادي.
//
//  التوكن والـ chat id(s) لسه محفوظين في Supabase Secrets بتاعة
//  notify-telegram نفسها (TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_IDS)
//  ومبيتعرضوش هنا في كود الموقع خالص — إحنا بس بنستدعي الفنكشن،
//  وهي اللي بتقرا القيم دي من عندها وتبعت الرسالة.
//
//  الاستخدام:
//   await window.totaNotifyTelegram(client, 'orders', 'INSERT', orderRow);
//   await window.totaNotifyTelegram(client, 'orders', 'UPDATE', orderRow, { delivery_status: 'not_shipped' });
// ============================================================
(function () {
  'use strict';

  window.totaNotifyTelegram = async function (client, table, type, record, oldRecord) {
    if (!client || !record) return;
    try {
      await client.functions.invoke('notify-telegram', {
        body: {
          table: table,
          type: type,
          record: record,
          old_record: oldRecord || null
        }
      });
    } catch (e) {
      // بنتجاهل فشل الإشعار عمدًا — العملية الأساسية (تسجيل الأوردر/
      // الطلب) لازم تنجح وتفضل متسجلة حتى لو الإشعار فشل لأي سبب
      // (نت، الفنكشن واقعة مؤقتًا، إلخ). العملية نفسها مش هتترجع أو
      // تفشل بسبب فشل الإشعار.
      console.error('تعذر إرسال إشعار تليجرام:', e);
    }
  };
})();
