# تخصيص شكل المنتجات (themes/products)

الفولدر ده بيتحكم فيه بالكامل من برنامج الأدمن (شاشة "تخصيص الشكل" في
تعديل أي منتج). مش المفروض تعدّل فيه يدوي عادةً، لكن ده شكل الملفات
لو احتجت تراجعها أو تصلّحها يدوي.

- كل منتج عليه تخصيص بياخد ملف باسم `<categorySlug>__<slug>.json`
  (يعني نفس الـ id بتاع المنتج في `data/products.json`، بس بدل "/"
  بيتحط "__"). مثال: `accessories/ayat-alkursi-bracelet` → الملف
  `accessories__ayat-alkursi-bracelet.json`.
- لو المنتج **مفيهوش** ملف هنا، شكله بيرجع تلقائيًا لشكل الموقع
  الافتراضي من غير أي تدخل.

## شكل الملف

```json
{
  "sameForBothModes": false,
  "light": {
    "background": "#FFFBF6",
    "text": "#3E362D",
    "textSoft": "#93876F",
    "border": "#F0E3D2",
    "button": "#E8927C",
    "borderRadius": 20,
    "borderStyle": "solid",
    "shadow": { "enabled": true, "color": "#5A4632", "opacity": 0.08, "blur": 34, "y": 14 }
  },
  "dark": {
    "background": "#28221D",
    "text": "#F4EBE0",
    "textSoft": "#B7A995",
    "border": "#3C332A",
    "button": "#F0A48C",
    "borderRadius": 20,
    "borderStyle": "solid",
    "shadow": { "enabled": true, "color": "#000000", "opacity": 0.38, "blur": 34, "y": 14 }
  }
}
```

- كل حقل اختياري — لو اتسيب فاضي بيرجع للقيمة الافتراضية بتاعة الموقع.
- `borderStyle`: أي قيمة CSS صالحة لـ `border-style` (`solid`,
  `dashed`, `dotted`, `double`, ...).
- `sameForBothModes: true` بيخلي قيم `light` تتطبّق في الوضعين
  (فاتح وغامق مع بعض)، وقيم `dark` بيتم تجاهلها.
- الملف بيتقرا من `assets/js/product-theme.js` وبيتحقن كـ CSS مُحدّد
  النطاق (scoped) بس على الكارت والموديل بتوع المنتج ده، مفيش أي
  تأثير على أي منتج تاني.
