// ============================================================
//  ملف إعدادات "تواصل مع المصمم" — منفصل تمامًا عن ملف
//  data/config.json (اللي بيتحكم فيه برنامج التصميم بتاعك).
//
//  ده معناه إنك تقدر تعدّل اللينك هنا يدويًا من غير ما يتلخبط
//  مع أي حاجة بيتحكم فيها البرنامج، ومن غير ما يظهر أصلاً كمتغير
//  جوه صفحة إدارة المتغيرات بتاعتك.
//
//  للتعديل: غيّر قيمة designerContactLink بس تحت، وحفظ الملف.
//  سيب designerContactLink فاضي "" لو عايز تخفي الزرار خالص.
// ============================================================

window.DESIGNER_CONFIG = {
  // اللينك اللي هيتفتح لما حد يدوس على زرار "تواصل مع المصمم"
  // حط هنا أي لينك تواصل (واتساب / تليجرام / إيميل / لينكدإن... إلخ)
  designerContactLink: "https://wa.me/201270472958",

  // نص الزرار (تقدر تغيّره لو حابب)
  designerButtonLabel: "تواصل مع المصمم"
};

// ============================================================
//  قوالب جاهزة لأشهر أنواع اللينكات — انسخ أي سطر وحطه بدل
//  قيمة designerContactLink اللي فوق (بعد ما تغيّر البيانات):
// ============================================================

// واتساب (رقم بالكود الدولي من غير + ولا مسافات ولا أصفار):
// designerContactLink: "https://wa.me/201000000000",

// واتساب مع رسالة جاهزة تتبعت تلقائي:
// designerContactLink: "https://wa.me/201000000000?text=" + encodeURIComponent("أهلاً، حابب أتواصل معاك بخصوص تصميم الموقع"),

// تليجرام (باليوزرنيم):
// designerContactLink: "https://t.me/your_username",

// تليجرام (برقم التليفون بدل اليوزرنيم):
// designerContactLink: "https://t.me/+201000000000",

// إيميل (بيفتح برنامج الإيميل مباشرة):
// designerContactLink: "mailto:you@example.com",

// إيميل مع موضوع ورسالة جاهزين:
// designerContactLink: "mailto:you@example.com?subject=" + encodeURIComponent("استفسار عن تصميم الموقع") + "&body=" + encodeURIComponent("أهلاً..."),

// مكالمة تليفون مباشرة (بيفتح تطبيق الاتصال في الموبايل):
// designerContactLink: "tel:+201000000000",

// رسالة SMS جاهزة:
// designerContactLink: "sms:+201000000000",

// لينكدإن:
// designerContactLink: "https://www.linkedin.com/in/your-username",

// فيسبوك (بروفايل أو صفحة):
// designerContactLink: "https://facebook.com/your.page",

// إنستجرام:
// designerContactLink: "https://instagram.com/your_username",

// ديسكورد (لينك دعوة سيرفر أو بروفايل):
// designerContactLink: "https://discord.com/users/000000000000000000",

// موقعك/بورتفوليو الشخصي:
// designerContactLink: "https://your-portfolio.example.com",
