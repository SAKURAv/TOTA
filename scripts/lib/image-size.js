/**
 * قارئ أبعاد صور بسيط (JPEG/PNG) من غير أي مكتبة خارجية.
 * تليجرام (على عكس واتساب/فيسبوك) بيرفض أحيانًا يعرض معاينة الصورة لو
 * meta tags بتاعة og:image:width / og:image:height مش موجودة أو غلط،
 * فبنقرا الأبعاد الحقيقية من بايتات الصورة نفسها ونكتبها في الـ HTML.
 *
 * بيرجع { width, height, type } أو null لو الملف مش JPEG/PNG أو تالف.
 */
const fs = require("fs");

function readPngSize(buf) {
  // PNG: 8 بايت signature + IHDR chunk (length 4 + "IHDR" 4 + width 4 + height 4)
  if (buf.length < 24) return null;
  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isPng) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, type: "image/png" };
}

function readJpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // SOI
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0-SOF15 markers (ماعدا DHT/JPG/DAC وغيرهم) بيحملوا الأبعاد
    const isSOF =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (isSOF) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height, type: "image/jpeg" };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function getImageSize(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return readPngSize(buf) || readJpegSize(buf) || null;
  } catch {
    return null;
  }
}

module.exports = { getImageSize };
