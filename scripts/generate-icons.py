#!/usr/bin/env python3
"""
بيولّد أيقونات الـ PWA (manifest.json) من ملف اللوجو الأساسي:
  assets/img/site-logo.(jpg|jpeg|png|webp|gif|bmp)

بيحط حواف أمان (padding) حوالين اللوجو عشان أندرويد/كروم لما يقص
الأيقونة على شكل دائرة (maskable icon) اللوجو ميتقصش من نص الصورة.

بيتشغّل تلقائيًا مع كل نشر (ضمن npm run build في GitHub Actions)، فمفيش
أي حاجة إضافية مطلوبة لما اللوجو يتغيّر من برنامج الأدمن أو يدويًا —
الأيقونات هتتحدث لوحدها في النشر الجاي.

3 حاجات مهمة اتضافت هنا عشان رفع اللوجو (من أي مصدر — برنامج الأدمن أو
يدوي) ميبوظش الموقع أبدًا:

1) بيقرا data/config.json (حقل "logo") الأول عشان يعرف اللوجو الحالي
   بالظبط — نفس المصدر اللي build-meta.js بيستخدمه للفافيكون. لو الحقل
   فاضي أو الملف اللي بيشاور عليه مش موجود، بيرجع للبحث القديم
   (site-logo.* أول امتداد يلاقيه) كاحتياطي. كده الأيقونات والفافيكون
   دايمًا بيتفقوا على نفس اللوجو ومفيش احتمال يحصل تعارض بينهم.

2) بعد ما يحدد اللوجو الصح، بيمسح أي ملف site-logo.* تاني بامتداد مختلف
   في نفس الفولدر (مثلاً لو كان فيه site-logo.jpg قديم متروك وبقى
   اللوجو الحالي site-logo.png) — عشان الفولدر ميتراكمش بصور لوجو ميتة
   بغض النظر عن مصدرها.

3) أي مشكلة (صيغة مش مدعومة زي HEIC، ملف تالف، أو حتى مفيش لوجو خالص)
   بتتسجل كتحذير واضح فالـ log وبيقف توليد الأيقونات بس — من غير ما
   يوقف باقي عملية النشر (منتجات/أسعار/كل حاجة تانية في الموقع). قبل
   كده كان أي خطأ هنا بيوقف النشر بالكامل بـ SystemExit.

للتشغيل يدويًا على جهازك (اختياري، للمعاينة قبل النشر):
  python3 scripts/generate-icons.py

محتاج مكتبة Pillow: pip install Pillow
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "img"
OUT_DIR = IMG_DIR / "icons"
CONFIG_JSON = ROOT / "data" / "config.json"
# الصيغ اللي Pillow بيقدر يفتحها من غير مكتبات إضافية. أي صيغة تانية
# (زي HEIC من آيفون) هتتلقط برسالة واضحة بدل ما تكسر النشر بالكامل.
LOGO_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]


def configured_logo() -> Path | None:
    """بيرجع مسار اللوجو المسجّل فعليًا في data/config.json (لو موجود
    وموجود فعليًا على القرص)، عشان نتأكد إن الأيقونات دايمًا من نفس
    اللوجو اللي باقي الموقع (الفافيكون) شغال بيه."""
    if not CONFIG_JSON.exists():
        return None
    try:
        config = json.loads(CONFIG_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        print(f"⚠ مش قادر أقرا data/config.json ({e}) — هستخدم البحث الاحتياطي")
        return None
    logo_rel = str(config.get("logo") or "").strip()
    if not logo_rel or logo_rel.startswith(("http://", "https://")):
        return None
    candidate = ROOT / logo_rel
    if candidate.exists():
        return candidate
    print(f"⚠ config.json بيشاور على لوجو مش موجود فعليًا ({logo_rel}) — هستخدم البحث الاحتياطي")
    return None


def find_logo_by_extension() -> Path | None:
    """احتياطي: بيدور على أول ملف site-logo.* موجود، بنفس ترتيب
    LOGO_EXTS. بيتستخدم بس لو مفيش لوجو مسجّل في config.json."""
    for ext in LOGO_EXTS:
        candidate = IMG_DIR / f"site-logo{ext}"
        if candidate.exists():
            return candidate
    return None


def clean_stale_logo_files(keep: Path) -> None:
    """بيمسح أي site-logo.* تاني غير اللي بيتستخدم فعليًا، عشان الفولدر
    ميتراكمش بصور قديمة أيًا كان مصدرها."""
    if not IMG_DIR.exists():
        return
    for f in IMG_DIR.glob("site-logo.*"):
        if f.resolve() != keep.resolve():
            f.unlink()
            print(f"  🗑 اتمسح لوجو قديم متراكم: {f.relative_to(ROOT)}")


def make_icon(src, size: int, out_path: Path, safe_ratio: float):
    from PIL import Image
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    logo_size = int(size * safe_ratio)
    logo = src.resize((logo_size, logo_size), Image.LANCZOS)
    offset = ((size - logo_size) // 2, (size - logo_size) // 2)
    canvas.paste(logo, offset, logo)
    canvas.convert("RGB").save(out_path, "PNG")
    print(f"  ✓ {out_path.relative_to(ROOT)}")


def main():
    logo_path = configured_logo() or find_logo_by_extension()

    if logo_path is None:
        print(f"⚠ مش لاقي أي لوجو (لا في config.json ولا site-logo.* جوه {IMG_DIR}).")
        print("  الأيقونات القديمة (لو موجودة) هتفضل زي ما هي، وباقي النشر هيكمل عادي.")
        return

    if logo_path.suffix.lower() not in LOGO_EXTS:
        print(f"⚠ صيغة اللوجو ({logo_path.suffix}) مش مدعومة لتوليد الأيقونات — الصيغ المدعومة: {', '.join(LOGO_EXTS)}.")
        print("  الأيقونات القديمة (لو موجودة) هتفضل زي ما هي، وباقي النشر هيكمل عادي.")
        return

    try:
        from PIL import Image
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        src = Image.open(logo_path)
        src.load()  # يتأكد من صحة الملف دلوقتي، مش لازي (lazy) وقت الـ resize
        src = src.convert("RGBA")
    except Exception as e:
        print(f"⚠ مش قادر أفتح ملف اللوجو ({logo_path.name}): {e}")
        print("  الأيقونات القديمة (لو موجودة) هتفضل زي ما هي، وباقي النشر هيكمل عادي.")
        return

    print(f"بيولّد الأيقونات من: {logo_path.name}")
    # أيقونات المانيفست العادية (any) — هامش أمان معتدل
    make_icon(src, 192, OUT_DIR / "icon-192.png", safe_ratio=0.78)
    make_icon(src, 512, OUT_DIR / "icon-512.png", safe_ratio=0.78)
    # نسخة maskable — هامش أمان أكبر عشان القص الدائري في أندرويد
    make_icon(src, 512, OUT_DIR / "icon-512-maskable.png", safe_ratio=0.72)
    # أيقونة آيفون (Add to Home Screen) — آبل بتعمل زوايا دائرية بس مش قص دائري كامل
    make_icon(src, 180, OUT_DIR / "icon-apple-touch.png", safe_ratio=0.85)

    # نضّف أي site-logo.* تاني (امتداد قديم متروك) بعد نجاح التوليد بس،
    # عشان لو فشل التوليد ميتمسحش اللوجو الحالي من غير ما تتولّد أيقونات بديلة.
    clean_stale_logo_files(logo_path)

    print("خلصت ✅")


if __name__ == "__main__":
    main()
