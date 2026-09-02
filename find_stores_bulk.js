/**
 * سكربت جمع المتاجر الشامل - نسخة JavaScript (Node.js)
 * ==========================================
 * نفس منطق find_stores_bulk.py: يبحث تلقائياً عن مئات متاجر سلة وزد
 * بمجالات كتيرة، يتجاهل أي متجر موجود مسبقاً بـ known_stores.csv (بغض
 * النظر عن المجال)، وبيحاول يسحب إيميل التواصل من كل متجر جديد.
 *
 * طريقة الاستخدام:
 * 1) نصّب المكتبات (مرة وحدة، يتطلب Node.js 18+ لتوفر fetch المدمج):
 *    npm install
 *
 * 2) شغل السكربت:
 *    node find_stores_bulk.js
 *
 * 3) النتيجة بتطلع بملف found_stores_bulk.csv فيه بس المتاجر الجديدة
 *    اللي انلقالها إيميل فعلي. أي متجر جديد بدون إيميل ما ينكتب بملف
 *    النتائج، بس بينحفظ بـ known_stores.csv حتى ما يترفحص من جديد.
 */

const fs = require("fs");
const path = require("path");
const { search, SafeSearchType } = require("duck-duck-scrape");

// ------------------------------------------------------------------
// مجالات كتيرة جداً - عدّل أو زيد حسب ما تحتاج
// كل سطر = عملية بحث منفصلة على سلة وزد
// (98 مجال × منصتين = 196 عملية بحث بالتشغيلة الوحدة)
//
// شلنا المجالات "التقليدية" (عبايات، فساتين، ساعات، عطور...) لأنها كانت
// مغطاة أصلاً بشكل كبير بقائمة known_stores.csv اليدوية، فصارت غالباً
// ترجع 0 نتيجة جديدة. عوضناها بمجالات جديدة كلياً لزيادة فرصة الاكتشاف.
// ------------------------------------------------------------------
const CATEGORIES = [
  "ملابس اطفال", "أحذية أطفال", "ألعاب أطفال", "عربات أطفال",
  "مستلزمات تعليم منزلي", "أدوات مدرسية", "شنط مدرسية", "يونيفورم مدارس",
  "نظارات طبية", "عدسات طبية", "ساعات ذكية", "اكسسوارات كمبيوتر",
  "لابتوبات", "طابعات وحبر", "أجهزة منزلية صغيرة", "مكانس كهربائية",
  "مكيفات وتبريد", "إضاءة منزلية", "سجاد وموكيت", "مفارش ومفروشات",
  "مناشف وبياضات", "أواني تقديم", "أدوات حلويات وبيسيري",
  "مستلزمات مطاعم", "مستلزمات مقاهي", "عبايات محجبات", "فساتين زفاف",
  "اكسسوارات عرايس", "بدلات رجالية", "قمصان رجالية", "بناطيل جينز",
  "ملابس بحر ومايوهات", "شنط يد فاخرة", "محافظ جلدية", "أحزمة رجالية",
  "ربطات عنق", "مجوهرات رجالية", "خواتم وأساور", "أقراط وحلق",
  "عطور نسائية فاخرة", "عطور رجالية", "بخاخات ومعطرات جو",
  "مستحضرات تجميل طبيعية", "منتجات عناية بالشعر",
  "مستلزمات صالونات تجميل", "أدوات مانيكير وباديكير", "رموش صناعية",
  "مستلزمات تدليك واسترخاء", "أدوات يوغا ولياقة", "دراجات هوائية",
  "لوحات تزلج", "مستلزمات صيد وقنص", "مستلزمات غوص وسباحة",
  "خيام تخييم فاخرة", "مواقد وشوايات", "أثاث مكتب منزلي",
  "كراسي قيمنق", "اكسسوارات قيمنق", "سماعات قيمنق", "طائرات درون",
  "اكسسوارات تصوير احترافي", "استوديوهات تصوير",
  "مستلزمات حفلات أطفال", "بالونات وتزيين", "كروت معايدة وهدايا مطبوعة",
  "اطارات وشهادات تخرج", "مستلزمات تغليف وتوضيب", "صناديق هدايا فاخرة",
  "مستلزمات شيشة ومعسل", "دلال وفناجيل قهوة عربية", "أقمشة بالجملة",
  "خيوط وأدوات تطريز", "أدوات كهربائية يدوية", "مستلزمات سباكة",
  "مستلزمات كهرباء منزلية", "بطاريات وشواحن", "ألواح طاقة شمسية",
  "أدوات زراعة منزلية", "بذور ونباتات زينة", "اكسسوارات دراجات نارية",
  "زيوت وصيانة سيارات", "أدوات غسيل وتلميع سيارات", "ملابس حوامل",
  "ألعاب لوحية وبازلات", "أزياء تنكرية وحفلات", "أدوات خط عربي وزخرفة",
  "تحف وأنتيكات", "عملات وطوابع قديمة", "مستلزمات مخابز وحلويات منزلية",
  "ملابس عمل وسلامة مهنية", "نظارات وقفازات سلامة",
  "كراسي متحركة ومعينات حركية", "مستلزمات تمريض ورعاية مسنين",
  "زينة رمضان", "زينة العيد", "ساعات حائط وديكور",
  "صناديق وتغليف هدايا يدوي", "اكسسوارات فاخرة للموبايل وحافظات",
];

const PLATFORMS = ["site:salla.sa", "site:zid.store"];

const RESULTS_PER_QUERY = 100;
const OUTPUT_FILE = path.join(__dirname, "found_stores_bulk.csv");
const KNOWN_STORES_FILE = path.join(__dirname, "known_stores.csv");
const DELAY_BETWEEN_SEARCHES_MS = 3000; // مهم جداً عشان ما تنحظر من محرك البحث
const DELAY_BETWEEN_EMAIL_FETCHES_MS = 2000; // فاصل بين زيارة كل متجر لسحب الإيميل

const EXCLUDE_KEYWORDS = [
  "amazon", "noon", "jumia", "شركة سلة", "منصة سلة", "help.salla",
  "docs.salla", "academy.salla", "blog.salla",
];

// مسارات صفحات "تواصل معنا" الشائعة بمتاجر سلة وزد - تنجرب لو ما انلقى
// إيميل بالصفحة الرئيسية للمتجر
const CONTACT_PATHS = [
  "", "/pages/contact-us", "/pages/contact", "/contactus",
  "/ar/contact-us", "/pages/about-us", "/policies/contact-information",
];

const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

// لواحق ملفات بتتصادف مع نمط الإيميل داخل الصفحات (سكربتات/صور) - نتجاهلها
const BAD_EMAIL_SUFFIXES = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".js", ".css"];
const BAD_EMAIL_DOMAINS_CONTAINS = ["sentry.io", "example.com", "wixpress.com", "godaddy.com"];

const REQUEST_HEADERS = {
  "User-Agent": (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  ),
};
const REQUEST_TIMEOUT_MS = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isExcluded(url, title = "") {
  const combined = (url + " " + title).toLowerCase();
  return EXCLUDE_KEYWORDS.some((bad) => combined.includes(bad));
}

/**
 * يرجع مفتاح ثابت يمثل المتجر بغض النظر عن http/https أو www أو / بالنهاية،
 * عشان نقدر نقارن رابط جديد مع قائمة known_stores.csv بدون تكرار كاذب.
 */
function normalizeStoreKey(inputUrl) {
  if (!inputUrl) return "";
  let url = inputUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }

  let netloc = parsed.hostname.toLowerCase();
  if (netloc.startsWith("www.")) {
    netloc = netloc.slice(4);
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);

  // روابط سلة اللي شكلها salla.sa/store-slug بيكون المعرّف الحقيقي هو
  // اسم المتجر (أول جزء بالمسار)، مو دومين سلة نفسه
  if (netloc === "salla.sa" && pathParts.length) {
    return `salla.sa/${pathParts[0].toLowerCase()}`;
  }

  // نفس الفكرة لبعض روابط زد اللي فيها مسار متجر بعد zid.store/
  if (netloc === "zid.store" && pathParts.length) {
    return `zid.store/${pathParts[0].toLowerCase()}`;
  }

  return netloc;
}

function loadKnownStores(filePath) {
  const known = new Set();
  if (!fs.existsSync(filePath)) {
    console.log(`تنبيه: ملف '${filePath}' مو موجود - رح يكمل بدون استبعاد.`);
    return known;
  }

  const content = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  for (const line of lines.slice(1)) {
    // تجاوز صف العناوين
    const firstComma = line.indexOf(",");
    if (firstComma === -1) continue;
    const secondComma = line.indexOf(",", firstComma + 1);
    if (secondComma === -1) continue;
    const url = line.slice(secondComma + 1).trim();
    const key = normalizeStoreKey(url);
    if (key) known.add(key);
  }

  return known;
}

function extractEmailFromHtml(html) {
  if (!html) return "";
  const matches = html.match(EMAIL_REGEX) || [];
  for (let email of matches) {
    email = email.trim().replace(/[.,;:)('"]+$/, "");
    const lowered = email.toLowerCase();
    if (BAD_EMAIL_SUFFIXES.some((suf) => lowered.endsWith(suf))) continue;
    if (BAD_EMAIL_DOMAINS_CONTAINS.some((bad) => lowered.includes(bad))) continue;
    return email;
  }
  return "";
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يزور الصفحة الرئيسية للمتجر، وإذا ما لقى إيميل يجرب أشهر مسارات
 * صفحة "تواصل معنا". يرجع أول إيميل يلقاه أو نص فاضي.
 */
async function fetchStoreEmail(url) {
  let baseUrl = /^https?:\/\//i.test(url) ? url : "https://" + url;
  baseUrl = baseUrl.replace(/\/+$/, "");

  for (const contactPath of CONTACT_PATHS) {
    try {
      const resp = await fetchWithTimeout(
        baseUrl + contactPath,
        { headers: REQUEST_HEADERS },
        REQUEST_TIMEOUT_MS
      );
      if (resp.ok) {
        const html = await resp.text();
        const email = extractEmailFromHtml(html);
        if (email) return email;
      }
    } catch {
      // تجاهل أخطاء الشبكة (مهلة، رفض اتصال...) وكمل على المسار التالي
    } finally {
      await sleep(DELAY_BETWEEN_EMAIL_FETCHES_MS);
    }
  }

  return "";
}

async function searchCategory(category, platform) {
  const query = `${platform} متجر ${category} تم شراءه`;
  const resultsFound = [];
  try {
    // بدون تقييد "region" جغرافي عشان ما نفوّت نتائج، حتى لو طلعت مواقع
    // غير سعودية/خليجية - سلة وزد أصلاً بيقيدوا الدومين
    const searchResults = await search(query, {
      safeSearch: SafeSearchType.OFF,
    });
    for (const r of searchResults.results || []) {
      const url = r.url;
      const title = r.title || "";
      if (!url || isExcluded(url, title)) continue;
      resultsFound.push({ category, title, url });
      if (resultsFound.length >= RESULTS_PER_QUERY) break;
    }
  } catch (e) {
    console.log(`  تحذير: صار خطأ بالبحث عن '${category}' على ${platform}: ${e.message}`);
  }
  return resultsFound;
}

function csvEscape(value) {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCsv(filePath, rows) {
  const header = ["category", "title", "url", "email"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((h) => csvEscape(row[h])).join(","));
  }
  fs.writeFileSync(filePath, "﻿" + lines.join("\n") + "\n", "utf8");
}

/**
 * يضيف المتاجر الجديدة اللي انلقت بهالتشغيلة لملف known_stores.csv،
 * عشان بالمرة الجاية تنعتبر "معروفة" ومايتكررش ظهورها من جديد.
 */
function appendToKnownStores(filePath, rows) {
  if (!rows.length) return;
  const lines = rows.map((r) => [r.category, r.title, r.url].map(csvEscape).join(",")).join("\n") + "\n";
  // ملاحظة: بدون BOM هون، حتى ما ينكتب BOM جديد بمنتصف الملف مع كل تشغيلة.
  fs.appendFileSync(filePath, lines, "utf8");
}

async function main() {
  const knownStores = loadKnownStores(KNOWN_STORES_FILE);
  console.log(`محمّل ${knownStores.size} متجر معروف من '${path.basename(KNOWN_STORES_FILE)}' - رح يتم استبعادهم.`);

  const allResults = [];
  const seenKeys = new Set();
  const totalSearches = CATEGORIES.length * PLATFORMS.length;
  let current = 0;

  for (const category of CATEGORIES) {
    for (const platform of PLATFORMS) {
      current += 1;
      console.log(`[${current}/${totalSearches}] بدور على: ${category} (${platform})`);

      const results = await searchCategory(category, platform);
      let newCount = 0;
      for (const r of results) {
        const key = normalizeStoreKey(r.url);
        if (!key || knownStores.has(key) || seenKeys.has(key)) continue;
        seenKeys.add(key);
        allResults.push(r);
        newCount += 1;
      }

      console.log(`   لقيت ${newCount} موقع جديد (الإجمالي: ${allResults.length})`);
      await sleep(DELAY_BETWEEN_SEARCHES_MS);
    }
  }

  console.log(`\nبدأ سحب الإيميلات لـ ${allResults.length} متجر جديد...`);
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    console.log(`[${i + 1}/${allResults.length}] بسحب إيميل: ${r.url}`);
    r.email = await fetchStoreEmail(r.url);
    console.log(r.email ? `   لقيت إيميل: ${r.email}` : "   ما لقيت إيميل - رح يتجاهل من ملف النتائج");
  }

  // نكتب بملف النتائج بس المتاجر اللي فعلاً انلقالها إيميل
  const resultsWithEmail = allResults.filter((r) => r.email);
  writeCsv(OUTPUT_FILE, resultsWithEmail);

  // نضيف كل المتاجر الجديدة (حتى اللي بدون إيميل) لقائمة المعروفين
  // عشان ما يترفحصوا من جديد بالتشغيلة الجاية
  appendToKnownStores(KNOWN_STORES_FILE, allResults);

  console.log(`\n✅ خلص! اكتشفت ${allResults.length} متجر جديد، منهم ${resultsWithEmail.length} فيهم إيميل.`);
  console.log(`📄 المتاجر اللي فيها إيميل محفوظة بملف: ${path.basename(OUTPUT_FILE)}`);
  if (allResults.length) {
    console.log(`📌 كل المتاجر الجديدة (حتى اللي بدون إيميل) انضافت لملف '${path.basename(KNOWN_STORES_FILE)}' عشان ما يتكرروا بالمرة الجاية.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
