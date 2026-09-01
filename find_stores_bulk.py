"""
سكربت جمع المتاجر الشامل - نسخة محسّنة
==========================================
يبحث تلقائياً عن مئات متاجر سلة وزد بمجالات كتيرة، ويجمعهم بملف واحد،
وبيحاول كمان يسحب إيميل التواصل من كل متجر جديد.

يتجاهل السكربت أي متجر موجود مسبقاً بملف known_stores.csv (نفس القائمة
اللي جمعتها يدوياً) - حتى لو طلع تحت مجال مختلف، ما رح يتكرر معك.

طريقة الاستخدام:
1) نصّب المكتبات (مرة وحدة):
   pip install duckduckgo-search requests --break-system-packages

2) شغل السكربت:
   python3 find_stores_bulk.py

3) النتيجة بتطلع بملف found_stores_bulk.csv فيه كل الروابط الفريدة
   الجديدة (اللي مو موجودة بـ known_stores.csv) + عمود email لو انلقى.
   (السكربت بياخذ وقت، لأنه بيسوي عشرات عمليات البحث + زيارة كل متجر
   جديد لسحب الإيميل، بفواصل زمنية عشان ما ينحظر - هذا طبيعي ومطلوب)
"""

import csv
import os
import re
import time
from urllib.parse import urlparse

try:
    from duckduckgo_search import DDGS
except ImportError:
    print("لازم تنصب المكتبة أول: pip install duckduckgo-search --break-system-packages")
    raise SystemExit

try:
    import requests
except ImportError:
    print("لازم تنصب المكتبة أول: pip install requests --break-system-packages")
    raise SystemExit

# ------------------------------------------------------------------
# مجالات كتيرة جداً - عدّل أو زيد حسب ما تحتاج
# كل سطر = عملية بحث منفصلة على سلة وزد
# ------------------------------------------------------------------
CATEGORIES = [
    "عبايات", "فساتين سهرة", "ملابس رجالية", "ملابس نسائية", "ساعات",
    "اكسسوارات نسائية", "اكسسوارات رجالية", "عطور", "بخور وعود", "مجوهرات",
    "مجوهرات فضة", "حقائب نسائية", "أحذية رجالية", "أحذية نسائية",
    "نظارات شمسية", "عدسات لاصقة", "مكياج", "عناية بالبشرة", "شموع",
    "ديكور منزل", "أثاث", "أدوات مطبخ", "قهوة مختصة", "شاي وقهوة",
    "قرطاسية", "هدايا", "ألعاب فيديو", "اكسسوارات جوال", "سماعات",
    "مستلزمات رياضية", "ملابس رياضية", "مكملات غذائية", "حيوانات أليفة",
    "أدوات فنية", "كتب", "شنط سفر", "خياطة وكروشية", "زي موحد",
    "اكسسوارات سيارات", "كفرات سيارات", "أزياء تراثية", "شماغ وعقال",
    "أدوات تنظيف", "عناية شخصية", "أطعمة ومكسرات", "عسل وتمور",
    "بقالة اونلاين", "أدوات تصوير", "كاميرات مراقبة", "خيام ورحلات",
    "أثاث حدائق", "لوحات جدارية", "إطارات صور", "شنط ظهر",
    "مستلزمات مواليد", "ذهب ومجوهرات فاخرة", "ملابس داخلية نسائية",
]

PLATFORMS = ["site:salla.sa", "site:zid.store"]

RESULTS_PER_QUERY = 10
OUTPUT_FILE = "found_stores_bulk.csv"
KNOWN_STORES_FILE = "known_stores.csv"
DELAY_BETWEEN_SEARCHES = 3  # ثواني - مهم جداً عشان ما تنحظر من محرك البحث
DELAY_BETWEEN_EMAIL_FETCHES = 2  # ثواني - فاصل بين زيارة كل متجر لسحب الإيميل

EXCLUDE_KEYWORDS = [
    "amazon", "noon", "jumia", "شركة سلة", "منصة سلة", "help.salla",
    "docs.salla", "academy.salla", "blog.salla",
]

# مسارات صفحات "تواصل معنا" الشائعة بمتاجر سلة وزد - تنجرب لو ما انلقى
# إيميل بالصفحة الرئيسية للمتجر
CONTACT_PATHS = [
    "", "/pages/contact-us", "/pages/contact", "/contactus",
    "/ar/contact-us", "/pages/about-us", "/policies/contact-information",
]

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

# لواحق ملفات بتتصادف مع نمط الإيميل داخل الصفحات (سكربتات/صور) - نتجاهلها
BAD_EMAIL_SUFFIXES = (
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".js", ".css",
)
BAD_EMAIL_DOMAINS_CONTAINS = (
    "sentry.io", "example.com", "wixpress.com", "godaddy.com",
)

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
REQUEST_TIMEOUT = 10


def is_excluded(url, title=""):
    combined = (url + " " + title).lower()
    return any(bad in combined for bad in EXCLUDE_KEYWORDS)


def normalize_store_key(url):
    """
    يرجع مفتاح ثابت يمثل المتجر بغض النظر عن http/https أو www أو / بالنهاية،
    عشان نقدر نقارن رابط جديد مع قائمة known_stores.csv بدون تكرار كاذب.
    """
    if not url:
        return ""
    url = url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url

    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]

    path_parts = [p for p in parsed.path.split("/") if p]

    # روابط سلة اللي شكلها salla.sa/store-slug بيكون المعرّف الحقيقي هو
    # اسم المتجر (أول جزء بالمسار)، مو دومين سلة نفسه
    if netloc == "salla.sa" and path_parts:
        return f"salla.sa/{path_parts[0].lower()}"

    # نفس الفكرة لبعض روابط زد اللي فيها مسار متجر بعد zid.store/
    if netloc == "zid.store" and path_parts:
        return f"zid.store/{path_parts[0].lower()}"

    return netloc


def load_known_stores(path):
    known = set()
    if not os.path.exists(path):
        print(f"تنبيه: ملف '{path}' مو موجود - رح يكمل بدون استبعاد.")
        return known

    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, None)  # تجاوز صف العناوين
        for row in reader:
            if len(row) < 3:
                continue
            url = row[2].strip()
            key = normalize_store_key(url)
            if key:
                known.add(key)
    return known


def extract_email_from_html(html):
    if not html:
        return ""
    for match in EMAIL_REGEX.findall(html):
        email = match.strip().strip(".,;:)('\"")
        lowered = email.lower()
        if lowered.endswith(BAD_EMAIL_SUFFIXES):
            continue
        if any(bad in lowered for bad in BAD_EMAIL_DOMAINS_CONTAINS):
            continue
        return email
    return ""


def fetch_store_email(url):
    """
    يزور الصفحة الرئيسية للمتجر، وإذا ما لقى إيميل يجرب أشهر مسارات
    صفحة "تواصل معنا". يرجع أول إيميل يلقاه أو نص فاضي.
    """
    if not re.match(r"^https?://", url):
        base_url = "https://" + url
    else:
        base_url = url
    base_url = base_url.rstrip("/")

    for path in CONTACT_PATHS:
        try:
            resp = requests.get(
                base_url + path,
                headers=REQUEST_HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code != 200:
                continue
            email = extract_email_from_html(resp.text)
            if email:
                return email
        except requests.RequestException:
            continue
        finally:
            time.sleep(DELAY_BETWEEN_EMAIL_FETCHES)

    return ""


def append_to_known_stores(path, results):
    """
    يضيف المتاجر الجديدة اللي انلقت بهالتشغيلة لملف known_stores.csv،
    عشان بالمرة الجاية تنعتبر "معروفة" ومايتكررش ظهورها من جديد.
    """
    if not results:
        return
    # ملاحظة: لازم encoding="utf-8" (مو utf-8-sig) بوضع الإضافة، حتى ما
    # ينكتب BOM جديد بمنتصف الملف مع كل تشغيلة.
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        for r in results:
            writer.writerow([r["category"], r["title"], r["url"]])


def search_category(ddgs, category, platform):
    query = f"{platform} متجر {category} تم شراءه"
    results_found = []
    try:
        results = ddgs.text(query, region="xa-ar", max_results=RESULTS_PER_QUERY)
        for r in results:
            url = r.get("href") or r.get("url")
            title = r.get("title", "")
            if not url or is_excluded(url, title):
                continue
            results_found.append({"category": category, "title": title, "url": url})
    except Exception as e:
        print(f"  تحذير: صار خطأ بالبحث عن '{category}' على {platform}: {e}")
    return results_found


def main():
    known_stores = load_known_stores(KNOWN_STORES_FILE)
    print(f"محمّل {len(known_stores)} متجر معروف من '{KNOWN_STORES_FILE}' - رح يتم استبعادهم.")

    all_results = []
    seen_keys = set()

    with DDGS() as ddgs:
        total_searches = len(CATEGORIES) * len(PLATFORMS)
        current = 0

        for category in CATEGORIES:
            for platform in PLATFORMS:
                current += 1
                print(f"[{current}/{total_searches}] بدور على: {category} ({platform})")

                results = search_category(ddgs, category, platform)
                new_count = 0
                for r in results:
                    key = normalize_store_key(r["url"])
                    if not key or key in known_stores or key in seen_keys:
                        continue
                    seen_keys.add(key)
                    all_results.append(r)
                    new_count += 1

                print(f"   لقيت {new_count} موقع جديد (الإجمالي: {len(all_results)})")
                time.sleep(DELAY_BETWEEN_SEARCHES)

    # سحب الإيميلات للمتاجر الجديدة فقط
    print(f"\nبدأ سحب الإيميلات لـ {len(all_results)} متجر جديد...")
    for i, r in enumerate(all_results, start=1):
        print(f"[{i}/{len(all_results)}] بسحب إيميل: {r['url']}")
        r["email"] = fetch_store_email(r["url"])
        if r["email"]:
            print(f"   لقيت إيميل: {r['email']}")
        else:
            print("   ما لقيت إيميل")

    # حفظ النتائج
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["category", "title", "url", "email"])
        writer.writeheader()
        writer.writerows(all_results)

    # إضافة المتاجر الجديدة لقائمة المعروفين عشان ما تتكرر بالتشغيلة الجاية
    append_to_known_stores(KNOWN_STORES_FILE, all_results)

    with_email = sum(1 for r in all_results if r["email"])
    print(f"\n✅ خلص! جمعت {len(all_results)} موقع فريد جديد ({with_email} فيهم إيميل).")
    print(f"📄 محفوظين بملف: {OUTPUT_FILE}")
    if all_results:
        print(f"📌 تمت إضافتهم كمان لملف '{KNOWN_STORES_FILE}' عشان ما يتكرروا بالمرة الجاية.")


if __name__ == "__main__":
    main()
