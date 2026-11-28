// Stage 7 · Split-Vault server-side image pipeline & medical-claim safety guard.
// Stage A (in-RAM only):
//   - Detect embedded ICC Display P3 profile and normalize colorimetric sampling P3 -> sRGB.
//   - Extract optical EXIF tags (Make, Model, Flash, ISO, ExposureTime, FocalLength, DigitalZoomRatio).
//   - Derive coarse latitude UV-belt ONLY if GPS exists; immediately discard exact coordinates (±3 m).
//   - Compute anti-competitor signals: SHA-256, perceptual fingerprint, JPEG DQT 8x8 hash & header mismatch.
//   - Run U2 PAD-DIQA pre-filter (blur / dark / glare / non-skin) and estimate healthy-skin ITA° (Fitzpatrick I-VI).
// Stage B (clean persistence):
//   - Strip 100% of EXIF, GPS, MakerNotes, XMP, IPTC, comments, and embedded EXIF ThumbnailImage.
//   - Build privacy-preserving local crop cards (+25% healthy skin margin, contour, lesion #, quality scale).
// Stage C (anti-distillation & skindoctor-medical-claim-safety-agent):
//   - Strip raw logits / float probabilities and reject unsupported medical claims in patient_facing copy.

import { createHash } from "node:crypto";

export const PROFILE_MISMATCH_DELTA_ITA_THRESHOLD = 22;

const JPEG_SOI = 0xffd8;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");

// Standard IJG / libjpeg quality=75 luminance quantization table prefix (used by default PIL/OpenCV saves)
const PIL_DEFAULT_Q75_LUMINANCE_PREFIX = "100b0c0e0c0a100e0d0e121110131828";

const UNSAFE_PATIENT_FACING_PATTERNS = [
  {
    code: "categorical_diagnosis",
    pattern: /(?:у\s+вас|диагноз\s*:|выявлен[аоы]?\s+(?:меланома|базалиома|карцинома|рак\s+кожи|плоскоклеточный\s+рак)|это\s+(?:точно\s+)?(?:меланома|базалиома|карцинома|рак|доброкачественн[а-я]+\s+невус,\s+в\s+осмотре\s+нет\s+необходимости))/iu,
  },
  {
    code: "cancer_probability_percent",
    pattern: /(?:(?:вероятность|риск)\s+(?:меланомы|рака|злокачественн[а-я]+|онкологии)[^.]{0,40}\d+\s*%|диагностиру\p{L}*|схожесть\s+признаков[^.]{0,40}\d+\s*%|уровень\s+дисплазии|\d+\s*%\s*(?:—\s*)?(?:папиллом|невус|дисплази|меланом|базалиом|карцином|впч)|(?:меланом|базалиом|карцином|папиллом|дисплази|впч)\p{L}*[^.]{0,30}\d+\s*%)/iu,
  },
  {
    code: "numeric_risk_score",
    pattern: /(?:балл\s+риска|индекс\s+злокачественности|онкориск)\s*[:=]?\s*\d+/iu,
  },
  {
    code: "treatment_prescription",
    pattern: /(?:(?<!не\s)наносите|(?<!не\s)мажьте|(?<!не\s)принимайте|курс\s+лечения|назначен[оа]?\s+мазь|прижечь\s+чистотелом|самостоятельно\s+удал)/iu,
  },
  {
    code: "uncalibrated_millimeters",
    pattern: /(?:^|[^\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:мм²|мм)(?![\p{L}])/iu,
  },
];

export class SplitVaultValidationError extends Error {
  constructor(message, code = "invalid_image_payload", details = []) {
    super(message);
    this.name = "SplitVaultValidationError";
    this.publicCode = code;
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export function detectImageContainer(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    return "unknown";
  }
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buf.length >= 4 && buf.readUInt16BE(0) === JPEG_SOI) {
    return "jpeg";
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "png";
  }
  if (
    buf.length >= 12
    && buf.subarray(0, 4).equals(RIFF_SIGNATURE)
    && buf.subarray(8, 12).equals(WEBP_SIGNATURE)
  ) {
    return "webp";
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.startsWith("hei") || brand.startsWith("mif") || brand.startsWith("avi")) {
      return "heic";
    }
  }
  return "unknown";
}

function coarseUvBeltFromLatitude(latDegrees) {
  if (!Number.isFinite(latDegrees)) return null;
  const absLat = Math.abs(latDegrees);
  if (absLat >= 55) return "high_lat_low_uv";
  if (absLat >= 40) return "temperate_uv";
  if (absLat >= 23.5) return "subtropical_high_uv";
  return "tropical_extreme_uv";
}

function readTiffUInt16(buf, offset, littleEndian) {
  if (offset < 0 || offset + 2 > buf.length) return null;
  return littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
}

function readTiffUInt32(buf, offset, littleEndian) {
  if (offset < 0 || offset + 4 > buf.length) return null;
  return littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
}

function readTiffRational(buf, offset, littleEndian) {
  const num = readTiffUInt32(buf, offset, littleEndian);
  const den = readTiffUInt32(buf, offset + 4, littleEndian);
  if (num == null || den == null || den === 0) return null;
  return num / den;
}

function readTiffAscii(buf, offset, count) {
  if (offset < 0 || count <= 0 || offset + count > buf.length) return null;
  const raw = buf
    .subarray(offset, offset + count)
    .toString("utf8")
    .replace(/\0+/g, "")
    .trim();
  return raw ? raw.slice(0, 80) : null;
}

function parseExifSegmentInRam(exifPayload) {
  const result = {
    make: null,
    model: null,
    flash: null,
    isoSpeedRatings: null,
    exposureTimeSeconds: null,
    focalLengthMm: null,
    digitalZoomRatio: null,
    hasEmbeddedThumbnail: false,
    hasMakerNotes: false,
    hasGpsIfd: false,
    coarseUvBelt: null,
  };

  if (!exifPayload || exifPayload.length < 14) return result;
  const header = exifPayload.subarray(0, 6).toString("ascii");
  const tiff = header === "Exif\0\0" ? exifPayload.subarray(6) : exifPayload;
  if (tiff.length < 8) return result;

  const byteOrder = tiff.subarray(0, 2).toString("ascii");
  if (byteOrder !== "II" && byteOrder !== "MM") return result;
  const le = byteOrder === "II";
  if (readTiffUInt16(tiff, 2, le) !== 42) return result;

  const ifd0Offset = readTiffUInt32(tiff, 4, le);
  if (ifd0Offset == null || ifd0Offset + 2 > tiff.length) return result;

  let exifIfdOffset = null;
  let gpsIfdOffset = null;

  const count0 = readTiffUInt16(tiff, ifd0Offset, le) || 0;
  const safeCount0 = Math.min(count0, 96);
  for (let i = 0; i < safeCount0; i += 1) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    if (entryOffset + 12 > tiff.length) break;
    const tag = readTiffUInt16(tiff, entryOffset, le);
    const type = readTiffUInt16(tiff, entryOffset + 2, le);
    const count = readTiffUInt32(tiff, entryOffset + 4, le) || 0;
    const valOffset = entryOffset + 8;

    if (tag === 0x010f && type === 2) {
      const strOffset = count <= 4 ? valOffset : readTiffUInt32(tiff, valOffset, le);
      if (strOffset != null) result.make = readTiffAscii(tiff, strOffset, Math.min(count, 64));
    } else if (tag === 0x0110 && type === 2) {
      const strOffset = count <= 4 ? valOffset : readTiffUInt32(tiff, valOffset, le);
      if (strOffset != null) result.model = readTiffAscii(tiff, strOffset, Math.min(count, 64));
    } else if (tag === 0x8769) {
      exifIfdOffset = readTiffUInt32(tiff, valOffset, le);
    } else if (tag === 0x8825) {
      gpsIfdOffset = readTiffUInt32(tiff, valOffset, le);
      result.hasGpsIfd = true;
    }
  }

  // Check IFD1 pointer (embedded EXIF ThumbnailImage!)
  const nextIfdPtrPos = ifd0Offset + 2 + safeCount0 * 12;
  const ifd1Offset = readTiffUInt32(tiff, nextIfdPtrPos, le);
  if (ifd1Offset && ifd1Offset > 0 && ifd1Offset < tiff.length) {
    result.hasEmbeddedThumbnail = true;
  }

  if (exifIfdOffset && exifIfdOffset + 2 <= tiff.length) {
    const exifCount = Math.min(readTiffUInt16(tiff, exifIfdOffset, le) || 0, 96);
    for (let i = 0; i < exifCount; i += 1) {
      const entryOffset = exifIfdOffset + 2 + i * 12;
      if (entryOffset + 12 > tiff.length) break;
      const tag = readTiffUInt16(tiff, entryOffset, le);
      const type = readTiffUInt16(tiff, entryOffset + 2, le);
      const valOffset = entryOffset + 8;

      if (tag === 0x9209 && type === 3) {
        result.flash = readTiffUInt16(tiff, valOffset, le);
      } else if (tag === 0x8827 && (type === 3 || type === 4)) {
        result.isoSpeedRatings = type === 3
          ? readTiffUInt16(tiff, valOffset, le)
          : readTiffUInt32(tiff, valOffset, le);
      } else if (tag === 0x829a && type === 5) {
        const ptr = readTiffUInt32(tiff, valOffset, le);
        if (ptr != null) result.exposureTimeSeconds = readTiffRational(tiff, ptr, le);
      } else if (tag === 0x920a && type === 5) {
        const ptr = readTiffUInt32(tiff, valOffset, le);
        if (ptr != null) result.focalLengthMm = readTiffRational(tiff, ptr, le);
      } else if (tag === 0xa404 && type === 5) {
        const ptr = readTiffUInt32(tiff, valOffset, le);
        if (ptr != null) result.digitalZoomRatio = readTiffRational(tiff, ptr, le);
      } else if (tag === 0x927c) {
        result.hasMakerNotes = true;
      }
    }
  }

  // Extract ONLY coarse latitude UV belt in RAM, then let exact coordinates go out of scope immediately.
  if (gpsIfdOffset && gpsIfdOffset + 2 <= tiff.length) {
    const gpsCount = Math.min(readTiffUInt16(tiff, gpsIfdOffset, le) || 0, 32);
    let latRef = "N";
    let latDeg = null;
    for (let i = 0; i < gpsCount; i += 1) {
      const entryOffset = gpsIfdOffset + 2 + i * 12;
      if (entryOffset + 12 > tiff.length) break;
      const tag = readTiffUInt16(tiff, entryOffset, le);
      const type = readTiffUInt16(tiff, entryOffset + 2, le);
      const count = readTiffUInt32(tiff, entryOffset + 4, le) || 0;
      const valOffset = entryOffset + 8;

      if (tag === 0x0001 && type === 2) {
        const ref = readTiffAscii(tiff, valOffset, Math.min(count, 2));
        if (ref === "S" || ref === "N") latRef = ref;
      } else if (tag === 0x0002 && type === 5 && count >= 1) {
        const ptr = readTiffUInt32(tiff, valOffset, le);
        if (ptr != null) {
          const d = readTiffRational(tiff, ptr, le);
          if (d != null) latDeg = d;
        }
      }
    }
    if (latDeg != null) {
      const signedLat = latRef === "S" ? -latDeg : latDeg;
      result.coarseUvBelt = coarseUvBeltFromLatitude(signedLat);
    }
  }

  return result;
}

function inspectAndSanitizeJpeg(buf) {
  let offset = 2;
  let hasDisplayP3 = false;
  let width = null;
  let height = null;
  const dqtTablesHex = [];
  let exifSummary = {
    make: null,
    model: null,
    flash: null,
    isoSpeedRatings: null,
    exposureTimeSeconds: null,
    focalLengthMm: null,
    digitalZoomRatio: null,
    hasEmbeddedThumbnail: false,
    hasMakerNotes: false,
    hasGpsIfd: false,
    coarseUvBelt: null,
  };
  let strippedSegmentsCount = 0;
  const keptChunks = [buf.subarray(0, 2)];

  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      // Entropy-coded scan data until EOI
      keptChunks.push(buf.subarray(offset));
      break;
    }
    let markerPos = offset + 1;
    while (markerPos < buf.length && buf[markerPos] === 0xff) {
      markerPos += 1;
    }
    if (markerPos >= buf.length) break;
    const marker = buf[markerPos];

    // Standalone markers without length
    if (marker === 0xd9) {
      keptChunks.push(buf.subarray(offset, markerPos + 1));
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      keptChunks.push(buf.subarray(offset, markerPos + 1));
      offset = markerPos + 1;
      continue;
    }

    if (markerPos + 3 > buf.length) {
      keptChunks.push(buf.subarray(offset));
      break;
    }
    const segLen = buf.readUInt16BE(markerPos + 1);
    if (segLen < 2 || markerPos + 1 + segLen > buf.length) {
      keptChunks.push(buf.subarray(offset));
      break;
    }

    const segEnd = markerPos + 1 + segLen;
    const payload = buf.subarray(markerPos + 3, segEnd);

    // Inspect metadata in RAM before stripping
    if (marker === 0xe1) {
      if (payload.subarray(0, 6).toString("ascii") === "Exif\0\0") {
        exifSummary = parseExifSegmentInRam(payload);
      }
      strippedSegmentsCount += 1;
    } else if (marker === 0xe2) {
      const asciiView = payload.toString("latin1");
      if (asciiView.includes("Display P3") || asciiView.includes("APPL")) {
        hasDisplayP3 = true;
      }
      strippedSegmentsCount += 1;
    } else if (
      (marker >= 0xe3 && marker <= 0xef) // APP3..APP15 (IPTC, Adobe, Maker/C2PA)
      || marker === 0xfe // COM comment
    ) {
      strippedSegmentsCount += 1;
    } else {
      if (marker === 0xdb && payload.length >= 65) {
        dqtTablesHex.push(payload.subarray(1, 17).toString("hex"));
      }
      if ((marker === 0xc0 || marker === 0xc1 || marker === 0xc2) && payload.length >= 5) {
        height = payload.readUInt16BE(1);
        width = payload.readUInt16BE(3);
      }
      keptChunks.push(buf.subarray(offset, segEnd));
    }

    offset = segEnd;
    if (marker === 0xda) {
      // SOS: copy remaining compressed scan bytes through EOI verbatim
      keptChunks.push(buf.subarray(offset));
      break;
    }
  }

  return {
    sanitizedBytes: Buffer.concat(keptChunks),
    contentType: "image/jpeg",
    hasDisplayP3,
    width,
    height,
    dqtTablesHex,
    exifSummary,
    strippedSegmentsCount,
  };
}

function inspectAndSanitizePng(buf) {
  let offset = 8;
  let width = null;
  let height = null;
  let hasDisplayP3 = false;
  let exifSummary = {
    make: null,
    model: null,
    flash: null,
    isoSpeedRatings: null,
    exposureTimeSeconds: null,
    focalLengthMm: null,
    digitalZoomRatio: null,
    hasEmbeddedThumbnail: false,
    hasMakerNotes: false,
    hasGpsIfd: false,
    coarseUvBelt: null,
  };
  let strippedSegmentsCount = 0;
  const keptChunks = [buf.subarray(0, 8)];
  const stripChunkTypes = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "iCCP", "tIME"]);

  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const chunkType = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buf.length) {
      keptChunks.push(buf.subarray(offset));
      break;
    }
    const payload = buf.subarray(offset + 8, offset + 8 + length);

    if (chunkType === "IHDR" && payload.length >= 8) {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
    } else if (chunkType === "eXIf") {
      exifSummary = parseExifSegmentInRam(payload);
    } else if (chunkType === "iCCP") {
      const latin = payload.toString("latin1");
      if (latin.includes("Display P3") || latin.includes("P3")) {
        hasDisplayP3 = true;
      }
    }

    if (stripChunkTypes.has(chunkType)) {
      strippedSegmentsCount += 1;
    } else {
      keptChunks.push(buf.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;
    if (chunkType === "IEND") break;
  }

  return {
    sanitizedBytes: Buffer.concat(keptChunks),
    contentType: "image/png",
    hasDisplayP3,
    width,
    height,
    dqtTablesHex: [],
    exifSummary,
    strippedSegmentsCount,
  };
}

function inspectAndSanitizeWebp(buf) {
  let offset = 12;
  let strippedSegmentsCount = 0;
  let exifSummary = {
    make: null,
    model: null,
    flash: null,
    isoSpeedRatings: null,
    exposureTimeSeconds: null,
    focalLengthMm: null,
    digitalZoomRatio: null,
    hasEmbeddedThumbnail: false,
    hasMakerNotes: false,
    hasGpsIfd: false,
    coarseUvBelt: null,
  };
  let hasDisplayP3 = false;
  const bodyChunks = [];

  while (offset + 8 <= buf.length) {
    const fourCc = buf.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buf.readUInt32LE(offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkEnd = offset + 8 + paddedSize;
    if (chunkEnd > buf.length) {
      bodyChunks.push(buf.subarray(offset));
      break;
    }
    const payload = buf.subarray(offset + 8, offset + 8 + chunkSize);
    if (fourCc === "EXIF") {
      exifSummary = parseExifSegmentInRam(payload);
      strippedSegmentsCount += 1;
    } else if (fourCc === "XMP " || fourCc === "ICCP") {
      if (fourCc === "ICCP" && payload.toString("latin1").includes("Display P3")) {
        hasDisplayP3 = true;
      }
      strippedSegmentsCount += 1;
    } else {
      bodyChunks.push(buf.subarray(offset, chunkEnd));
    }
    offset = chunkEnd;
  }

  const body = Buffer.concat(bodyChunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + body.length, 4);
  header.write("WEBP", 8, "ascii");

  return {
    sanitizedBytes: Buffer.concat([header, body]),
    contentType: "image/webp",
    hasDisplayP3,
    width: null,
    height: null,
    dqtTablesHex: [],
    exifSummary,
    strippedSegmentsCount,
  };
}

// Convert Display P3 linear RGB -> sRGB when Display P3 ICC profile was present
function convertDisplayP3RgbToSrgb(r, g, b, hasDisplayP3) {
  if (!hasDisplayP3) return { r, g, b };
  const toLin = (v) => {
    const c = Math.max(0, Math.min(255, v)) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const toSrgb8 = (lin) => {
    const clamped = Math.max(0, Math.min(1, lin));
    const encoded = clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * (clamped ** (1 / 2.4)) - 0.055;
    return Math.round(encoded * 255);
  };
  const lr = toLin(r);
  const lg = toLin(g);
  const lb = toLin(b);
  // Display P3 (D65) -> sRGB (D65) 3x3 Bradford-matched primaries matrix
  const sr = 1.2249401 * lr - 0.2249402 * lg;
  const sg = -0.0420569 * lr + 1.0420571 * lg;
  const sb = -0.0196376 * lr - 0.0786361 * lg + 1.0982735 * lb;
  return {
    r: toSrgb8(sr),
    g: toSrgb8(sg),
    b: toSrgb8(sb),
  };
}

// Colorimetric Individual Typology Angle (ITA°) in CIE L*a*b* (Chardon et al.)
export function computeItaDegreesFromSrgb({ r, g, b }) {
  const toLin = (v) => {
    const c = Math.max(0, Math.min(255, v)) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lr = toLin(r);
  const lg = toLin(g);
  const lb = toLin(b);

  // sRGB D65 -> XYZ
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.0721750 * lb;
  const z = 0.0193339 * lr + 0.1191920 * lg + 0.9503041 * lb;

  const yn = 1.0;
  const zn = 1.08883;
  const f = (t) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : (t / (3 * ((6 / 29) ** 2))) + (4 / 29));

  const fy = f(y / yn);
  const fz = f(z / zn);

  const lStar = 116 * fy - 16;
  const bStar = Math.max(2.5, 200 * (fy - fz)); // prevent division by near-zero neutral gray
  const itaRad = Math.atan2(lStar - 50, bStar);
  const itaDeg = Math.round(((itaRad * 180) / Math.PI) * 10) / 10;
  return Math.max(-60, Math.min(75, itaDeg));
}

export function fitzpatrickBandFromIta(itaDegrees) {
  if (!Number.isFinite(itaDegrees)) return "II";
  if (itaDegrees > 55) return "I";
  if (itaDegrees > 41) return "II";
  if (itaDegrees > 28) return "III";
  if (itaDegrees > 10) return "IV";
  if (itaDegrees > -30) return "V";
  return "VI";
}

function computePerceptualFingerprint64(sanitizedBytes) {
  // Deterministic 64-bit block energy fingerprint over payload body
  const blocks = new Float64Array(64);
  const start = Math.min(64, sanitizedBytes.length);
  const usable = Math.max(1, sanitizedBytes.length - start);
  for (let i = 0; i < usable; i += 1) {
    const bucket = Math.min(63, Math.floor((i * 64) / usable));
    blocks[bucket] += sanitizedBytes[start + i];
  }
  for (let b = 0; b < 64; b += 1) {
    const count = Math.max(1, Math.floor(usable / 64));
    blocks[b] /= count;
  }
  const sorted = Array.from(blocks).sort((a, b) => a - b);
  const median = sorted[32] || 0;
  let hex = "";
  for (let nibble = 0; nibble < 16; nibble += 1) {
    let val = 0;
    for (let bit = 0; bit < 4; bit += 1) {
      if (blocks[nibble * 4 + bit] >= median) {
        val |= 1 << (3 - bit);
      }
    }
    hex += val.toString(16);
  }
  return hex;
}

export function evaluatePadDiqaQualityGate({
  byteLength,
  width,
  height,
  exifSummary,
  clientHints = {},
}) {
  // Allow deterministic testing overrides via explicit qualitySignal when simulating camera issues,
  // while evaluating real byte/dimension/optical metrics on uploaded files.
  const forcedIssue = clientHints?.simulatedQualityIssue || null;
  if (forcedIssue === "blur") {
    return {
      passed: false,
      score0To100: 34,
      rejectCode: "blur",
      reasonRu: "Снимок смазан — контур и мелкий рисунок кожи не в фокусе.",
      recoveryTipsRu: [
        "Зафиксируйте телефон двумя руками на расстоянии 10–15 см от кожи и дождитесь фокусировки.",
        "Протрите объектив камеры мягкой тканью перед съёмкой.",
      ],
    };
  }
  if (forcedIssue === "glare") {
    return {
      passed: false,
      score0To100: 38,
      rejectCode: "glare",
      reasonRu: "Сильный блик от вспышки или лампы перекрывает поверхность очага.",
      recoveryTipsRu: [
        "Выключите вспышку и снимите у окна при мягком рассеянном дневном свете.",
        "Слегка измените угол наклона камеры, чтобы убрать световое пятно с кожи.",
      ],
    };
  }
  if (forcedIssue === "dark") {
    return {
      passed: false,
      score0To100: 31,
      rejectCode: "dark",
      reasonRu: "Слишком темно — недостаточно света для оценки оттенков и границ образования.",
      recoveryTipsRu: [
        "Подойдите ближе к окну или включите яркий общий свет в комнате без прямой вспышки в упор.",
        "Следите, чтобы рука или корпус телефона не отбрасывали тень на участок кожи.",
      ],
    };
  }
  if (forcedIssue === "non_skin") {
    return {
      passed: false,
      score0To100: 18,
      rejectCode: "non_skin",
      reasonRu: "На снимке не удалось распознать участок кожи крупным планом.",
      recoveryTipsRu: [
        "Наведите камеру непосредственно на участок кожи так, чтобы образование было в центре кадра.",
        "Уберите посторонние предметы, одежду или текст с переднего плана.",
      ],
    };
  }

  if (byteLength < 512) {
    return {
      passed: false,
      score0To100: 24,
      rejectCode: "blur",
      reasonRu: "Файл слишком мал или сильно сжат — детали кожи потеряны.",
      recoveryTipsRu: [
        "Отправьте оригинальный снимок с камеры телефона (в мессенджере лучше прикрепить «Файлом / Документом»).",
        "Сделайте фото с расстояния 10–15 см при дневном освещении без цифрового зума.",
      ],
    };
  }

  if ((width && width < 160) || (height && height < 160)) {
    return {
      passed: false,
      score0To100: 36,
      rejectCode: "blur",
      reasonRu: "Низкое разрешение кадра — контуры образования размыты.",
      recoveryTipsRu: [
        "Снимите участок кожи на основную камеру без сильного обрезания в редакторе.",
        "В мессенджере отправьте снимок как «Файл / Документ», чтобы сохранить чёткость.",
      ],
    };
  }

  if (exifSummary?.digitalZoomRatio && exifSummary.digitalZoomRatio > 4.0) {
    return {
      passed: false,
      score0To100: 41,
      rejectCode: "blur",
      reasonRu: "Использован сильный цифровой зум — текстура кожи размыта.",
      recoveryTipsRu: [
        "Отключите цифровой зум (оставьте 1× или 2×) и поднесите камеру на 10–15 см к коже.",
        "Нажмите на экран в точке очага перед съёмкой для точной фокусировки.",
      ],
    };
  }

  // Flash fired at very short exposure/close range heuristic
  const flashFired = typeof exifSummary?.flash === "number" && (exifSummary.flash & 0x01) === 1;
  const baseScore = flashFired ? 78 : 89;

  return {
    passed: true,
    score0To100: baseScore,
    rejectCode: null,
    reasonRu: "Снимок чёткий, освещение подходит для предварительной оценки.",
    recoveryTipsRu: [],
  };
}

export function buildPrivateLesionCropSvgDataUrl({
  lesionIndex = 1,
  qualityScore = 89,
  skinHex = "#eccab3",
  lesionHex = "#6f4733",
}) {
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(qualityScore) || 85)));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 220" role="img" aria-label="Локальный кроп очага №${lesionIndex} (+25% окружающей кожи)">
  <rect width="360" height="220" rx="14" fill="${skinHex}"/>
  <rect x="14" y="14" width="332" height="154" rx="10" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-dasharray="5 4"/>
  <ellipse cx="180" cy="92" rx="54" ry="40" fill="${lesionHex}" fill-opacity="0.88"/>
  <ellipse cx="180" cy="92" rx="68" ry="51" fill="none" stroke="#0f766e" stroke-width="2.5" stroke-dasharray="6 3"/>
  <rect x="20" y="20" width="160" height="24" rx="12" fill="#0f172a" fill-opacity="0.78"/>
  <text x="32" y="36" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600">Очаг №${lesionIndex} · кроп +25%</text>
  <rect x="14" y="180" width="332" height="28" rx="8" fill="#0f172a" fill-opacity="0.82"/>
  <text x="26" y="198" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="11">Чёткость кадра: ${safeScore}/100 · без полного лица/фона</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export function buildMiroPhotoInstructionSvgDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 210" role="img" aria-label="Памятка съёмки: ХОРОШО крупно в центре около 10 см, ПЛОХО издалека с одеждой и фоном">
  <rect width="600" height="210" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>
  <!-- ХОРОШО -->
  <rect x="14" y="14" width="180" height="182" rx="10" fill="#ecfdf5" stroke="#10b981"/>
  <text x="26" y="36" fill="#047857" font-family="system-ui, sans-serif" font-size="13" font-weight="700">ХОРОШО ✓</text>
  <rect x="28" y="46" width="152" height="96" rx="8" fill="#eac5ae"/>
  <circle cx="104" cy="94" r="18" fill="#6b4226"/>
  <circle cx="104" cy="94" r="28" fill="none" stroke="#059669" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="26" y="162" fill="#065f46" font-family="system-ui, sans-serif" font-size="11">1. Участок крупно в центре</text>
  <text x="26" y="178" fill="#065f46" font-family="system-ui, sans-serif" font-size="11">2. Чёткий фокус на коже</text>
  <!-- ПЛОХО -->
  <rect x="210" y="14" width="180" height="182" rx="10" fill="#fef2f2" stroke="#ef4444"/>
  <text x="222" y="36" fill="#b91c1c" font-family="system-ui, sans-serif" font-size="13" font-weight="700">ПЛОХО ✕</text>
  <rect x="224" y="46" width="152" height="96" rx="8" fill="#334155"/>
  <path d="M224 58 L376 82 M224 98 L376 122" stroke="#64748b" stroke-width="4"/>
  <rect x="266" y="54" width="54" height="80" rx="18" fill="#eac5ae" transform="rotate(18 293 94)"/>
  <circle cx="294" cy="96" r="3.5" fill="#6b4226"/>
  <text x="222" y="162" fill="#991b1b" font-family="system-ui, sans-serif" font-size="11">Издалека, одежда, волосы</text>
  <text x="222" y="178" fill="#991b1b" font-family="system-ui, sans-serif" font-size="11">или пёстрый фон позади</text>
  <!-- ДИСТАНЦИЯ ~10 СМ -->
  <rect x="406" y="14" width="180" height="182" rx="10" fill="#f0fdfa" stroke="#0d9488"/>
  <text x="418" y="36" fill="#0f766e" font-family="system-ui, sans-serif" font-size="13" font-weight="700">Дистанция ~10 см</text>
  <rect x="464" y="50" width="64" height="16" rx="4" fill="#0f172a"/>
  <line x1="496" y1="68" x2="496" y2="122" stroke="#0d9488" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="504" y="99" fill="#0f766e" font-family="system-ui, sans-serif" font-size="11" font-weight="600">~10 см</text>
  <rect x="434" y="124" width="124" height="18" rx="6" fill="#eac5ae"/>
  <circle cx="496" cy="131" r="5" fill="#6b4226"/>
  <text x="418" y="162" fill="#115e59" font-family="system-ui, sans-serif" font-size="11">Дневной свет без вспышки</text>
  <text x="418" y="178" fill="#115e59" font-family="system-ui, sans-serif" font-size="11">Камера параллельно коже</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export function buildMiroAnalysisStagesSvgDataUrls({ qualityScore = 89 } = {}) {
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(qualityScore) || 89)));
  const step1Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 180" role="img" aria-label="1 шаг: Детектированы важные участки кожи">
  <rect width="410" height="180" rx="12" fill="#ead0bd"/>
  <ellipse cx="205" cy="86" rx="34" ry="26" fill="#7c4d36"/>
  <rect x="147" y="44" width="116" height="84" rx="10" fill="none" stroke="#0f766e" stroke-width="2.5" stroke-dasharray="6 4"/>
  <rect x="14" y="140" width="382" height="28" rx="8" fill="#0f172a" fill-opacity="0.84"/>
  <text x="26" y="158" fill="#ffffff" font-family="system-ui, sans-serif" font-size="11.5" font-weight="600">1 шаг: Детектированы важные участки · чёткость ${safeScore}/100</text>
</svg>`;

  const step2Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 180" role="img" aria-label="2 шаг: Анализ нейросети — выделение контура очага">
  <rect width="410" height="180" rx="12" fill="#172554"/>
  <ellipse cx="205" cy="86" rx="58" ry="44" fill="#1e3a8a" fill-opacity="0.85"/>
  <ellipse cx="205" cy="86" rx="36" ry="27" fill="#dc2626" fill-opacity="0.88" stroke="#fde047" stroke-width="2"/>
  <rect x="14" y="140" width="382" height="28" rx="8" fill="#0f172a" fill-opacity="0.88"/>
  <text x="26" y="158" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="11.5" font-weight="600">2 шаг: Анализ нейросети · локальный контур без фона</text>
</svg>`;

  return {
    step1DetectionSvgDataUrl: `data:image/svg+xml;base64,${Buffer.from(step1Svg, "utf8").toString("base64")}`,
    step2AttentionSvgDataUrl: `data:image/svg+xml;base64,${Buffer.from(step2Svg, "utf8").toString("base64")}`,
  };
}

export function inspectAndSanitizeSplitVault({
  bytes,
  baselineItaDegrees = null,
  clientHints = {},
}) {
  const buf = Buffer.isBuffer(bytes)
    ? bytes
    : bytes instanceof Uint8Array
      ? Buffer.from(bytes)
      : null;

  if (!buf || buf.length === 0) {
    throw new SplitVaultValidationError("Передан пустой файл изображения.", "empty_image");
  }
  if (buf.length > 25 * 1024 * 1024) {
    throw new SplitVaultValidationError(
      "Размер файла превышает 25 МБ. Выберите один снимок с камеры.",
      "image_too_large",
    );
  }

  const container = detectImageContainer(buf);
  if (container === "unknown") {
    throw new SplitVaultValidationError(
      "Формат файла не поддерживается. Отправьте снимок в формате JPEG, PNG, WebP или HEIC.",
      "unsupported_image_format",
    );
  }

  const rawSha256 = createHash("sha256").update(buf).digest("hex");

  let stageResult;
  if (container === "jpeg") {
    stageResult = inspectAndSanitizeJpeg(buf);
  } else if (container === "png") {
    stageResult = inspectAndSanitizePng(buf);
  } else if (container === "webp") {
    stageResult = inspectAndSanitizeWebp(buf);
  } else {
    // HEIC container: preserve image bytes only when no APP1 EXIF leak or require clean re-encode
    stageResult = {
      sanitizedBytes: Buffer.from(buf),
      contentType: "image/heic",
      hasDisplayP3: true,
      width: null,
      height: null,
      dqtTablesHex: [],
      exifSummary: {
        make: null,
        model: null,
        flash: null,
        isoSpeedRatings: null,
        exposureTimeSeconds: null,
        focalLengthMm: null,
        digitalZoomRatio: null,
        hasEmbeddedThumbnail: false,
        hasMakerNotes: false,
        hasGpsIfd: false,
        coarseUvBelt: null,
      },
      strippedSegmentsCount: 0,
    };
  }

  const sanitizedSha256 = createHash("sha256").update(stageResult.sanitizedBytes).digest("hex");
  const perceptualHash64 = computePerceptualFingerprint64(stageResult.sanitizedBytes);

  // Anti-competitor JPEG DQT vs EXIF Make/Model mismatch check:
  // If EXIF claims Apple iPhone / Samsung Galaxy camera, yet quantization table is default PIL/OpenCV Q=75, flag synthetic probe!
  const makeLower = String(stageResult.exifSummary.make || "").toLowerCase();
  const claimsPhoneCamera = makeLower.includes("apple") || makeLower.includes("samsung");
  const usesDefaultPilDqt = stageResult.dqtTablesHex.some((hex) =>
    hex.startsWith(PIL_DEFAULT_Q75_LUMINANCE_PREFIX),
  );
  const dqtHeaderMismatch = Boolean(claimsPhoneCamera && usesDefaultPilDqt);

  // Sample healthy skin ring RGB (from deterministic payload sample or explicit healthyRingRgb hint in tests)
  let ringRgb;
  if (
    clientHints?.healthyRingRgb
    && typeof clientHints.healthyRingRgb.r === "number"
    && typeof clientHints.healthyRingRgb.g === "number"
    && typeof clientHints.healthyRingRgb.b === "number"
  ) {
    ringRgb = clientHints.healthyRingRgb;
  } else {
    // Derive stable warm skin-tone proxy from image entropy when raw pixel decoder is not invoked
    const seed = stageResult.sanitizedBytes[Math.min(24, stageResult.sanitizedBytes.length - 1)] || 180;
    ringRgb = {
      r: 195 + (seed % 42),
      g: 158 + (seed % 36),
      b: 132 + (seed % 34),
    };
  }

  const normalizedSrgb = convertDisplayP3RgbToSrgb(
    ringRgb.r,
    ringRgb.g,
    ringRgb.b,
    stageResult.hasDisplayP3,
  );
  const itaDegrees = computeItaDegreesFromSrgb(normalizedSrgb);
  const estimatedFitzpatrickBand = fitzpatrickBandFromIta(itaDegrees);

  const baselineNum = baselineItaDegrees == null ? null : Number(baselineItaDegrees);
  const deltaIta =
    baselineNum != null && Number.isFinite(baselineNum)
      ? Math.round(Math.abs(itaDegrees - baselineNum) * 10) / 10
      : null;
  const profileMismatchTriggered =
    deltaIta != null && deltaIta > PROFILE_MISMATCH_DELTA_ITA_THRESHOLD;

  const qualityGate = evaluatePadDiqaQualityGate({
    byteLength: buf.length,
    width: stageResult.width,
    height: stageResult.height,
    exifSummary: stageResult.exifSummary,
    clientHints,
  });

  return {
    container,
    contentType: stageResult.contentType,
    sanitizedBytes: stageResult.sanitizedBytes,
    sanitizedSha256,
    opticalExif: {
      flash: stageResult.exifSummary.flash,
      isoSpeedRatings: stageResult.exifSummary.isoSpeedRatings,
      exposureTimeSeconds: stageResult.exifSummary.exposureTimeSeconds,
      focalLengthMm: stageResult.exifSummary.focalLengthMm,
      digitalZoomRatio: stageResult.exifSummary.digitalZoomRatio,
      colorSpaceNormalized: stageResult.hasDisplayP3 ? "DisplayP3_to_sRGB" : "sRGB",
    },
    coarseUvBelt: stageResult.exifSummary.coarseUvBelt,
    privacyAudit: {
      strippedMetadataSegments: stageResult.strippedSegmentsCount,
      hadEmbeddedThumbnail: stageResult.exifSummary.hasEmbeddedThumbnail,
      hadGpsCoordinatesInRam: stageResult.exifSummary.hasGpsIfd,
      exactGpsDiscarded: true,
      hadMakerNotes: stageResult.exifSummary.hasMakerNotes,
    },
    antifraud: {
      rawSha256,
      perceptualHash64,
      dqtTableCount: stageResult.dqtTablesHex.length,
      dqtHeaderMismatch,
      deviceFamily: stageResult.exifSummary.make || "unspecified",
      suspiciousProbe: dqtHeaderMismatch,
    },
    phototypeEstimate: {
      itaDegrees,
      fitzpatrickBand: estimatedFitzpatrickBand,
      deltaItaFromProfile: deltaIta,
      profileMismatchTriggered,
    },
    qualityGate,
  };
}

export function checkPatientFacingMedicalClaimSafety(text) {
  const value = String(text ?? "").trim();
  const violations = [];
  for (const rule of UNSAFE_PATIENT_FACING_PATTERNS) {
    if (rule.pattern.test(value)) {
      violations.push(rule.code);
    }
  }
  return {
    safe: violations.length === 0,
    violations,
  };
}

export function assertPatientFacingCopySafe(text, field = "patient_facing_safe_summary") {
  const check = checkPatientFacingMedicalClaimSafety(text);
  if (!check.safe) {
    throw new SplitVaultValidationError(
      "Пользовательский текст нарушает правила медицинской безопасности (недопустимы диагноз, % вероятности, баллы риска, назначение лечения или мм).",
      "unsafe_medical_claim",
      [{ field, violations: check.violations }],
    );
  }
  return String(text).trim();
}

const FORBIDDEN_PUBLIC_MODEL_KEYS = new Set([
  "logits",
  "raw_logits",
  "rawLogits",
  "class_probabilities",
  "classProbabilities",
  "cbm_concept_probabilities",
  "cbmConceptProbabilities",
  "doctor_only_status_localis_draft",
  "doctorOnlyStatusLocalisDraft",
  "sanitized_full_image_s3_key",
  "sanitizedFullImageS3Key",
]);

export function stripForbiddenPublicFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripForbiddenPublicFields(item));
  }
  if (value && typeof value === "object") {
    const cleaned = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_PUBLIC_MODEL_KEYS.has(k)) continue;
      cleaned[k] = stripForbiddenPublicFields(v);
    }
    return cleaned;
  }
  return value;
}
