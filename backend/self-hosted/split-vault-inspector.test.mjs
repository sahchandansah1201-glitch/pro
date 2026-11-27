import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertPatientFacingCopySafe,
  checkPatientFacingMedicalClaimSafety,
  computeItaDegreesFromSrgb,
  fitzpatrickBandFromIta,
  inspectAndSanitizeSplitVault,
  stripForbiddenPublicFields,
} from "./split-vault-inspector.mjs";
import { createSyntheticValidJpegBuffer } from "./telegram-onboarding-bot.mjs";

test("Split-Vault Stage A/B detects Display P3, extracts coarse UV belt, and strips EXIF/GPS/Thumbnail from saved bytes", () => {
  const rawJpeg = createSyntheticValidJpegBuffer({
    width: 800,
    height: 600,
    displayP3: true,
    exifMake: "Apple",
    gpsLatDeg: 55.7558, // Moscow latitude -> high_lat_low_uv
    includeThumbnail: true,
    pilDefaultDqt: false,
  });

  assert.equal(rawJpeg.includes(Buffer.from("Exif\0\0", "ascii")), true);
  assert.equal(rawJpeg.includes(Buffer.from("Display P3", "ascii")), true);

  const result = inspectAndSanitizeSplitVault({
    bytes: rawJpeg,
    baselineItaDegrees: null,
    clientHints: { healthyRingRgb: { r: 224, g: 190, b: 168 } },
  });

  assert.equal(result.container, "jpeg");
  assert.equal(result.opticalExif.colorSpaceNormalized, "DisplayP3_to_sRGB");
  assert.equal(result.coarseUvBelt, "high_lat_low_uv");
  assert.equal(result.privacyAudit.hadEmbeddedThumbnail, true);
  assert.equal(result.privacyAudit.hadGpsCoordinatesInRam, true);
  assert.equal(result.privacyAudit.exactGpsDiscarded, true);
  assert.equal(result.antifraud.dqtHeaderMismatch, false);
  assert.equal(result.qualityGate.passed, true);

  // Verify 100% removal of EXIF, Display P3 ICC header, and GPS markers in persisted bytes
  assert.equal(result.sanitizedBytes.includes(Buffer.from("Exif\0\0", "ascii")), false);
  assert.equal(result.sanitizedBytes.includes(Buffer.from("Display P3", "ascii")), false);
  assert.equal(result.sanitizedBytes.includes(Buffer.from("Apple", "ascii")), false);
  // Exact GPS coordinates never appear anywhere in output object
  assert.doesNotMatch(JSON.stringify(result), /55\.7558|55755/);
});

test("Split-Vault flags anti-competitor DQT mismatch when EXIF claims Apple but quantization table is default PIL Q=75", () => {
  const spoofedJpeg = createSyntheticValidJpegBuffer({
    exifMake: "Apple",
    pilDefaultDqt: true,
  });

  const result = inspectAndSanitizeSplitVault({ bytes: spoofedJpeg });
  assert.equal(result.antifraud.dqtHeaderMismatch, true);
  assert.equal(result.antifraud.suspiciousProbe, true);
});

test("Split-Vault triggers Profile Mismatch Guard when |ΔITA°| > 22° from saved profile baseline", () => {
  const rawJpeg = createSyntheticValidJpegBuffer({ displayP3: false });
  const lightIta = computeItaDegreesFromSrgb({ r: 235, g: 208, b: 192 });
  assert.equal(fitzpatrickBandFromIta(lightIta), "I");

  const mismatched = inspectAndSanitizeSplitVault({
    bytes: rawJpeg,
    baselineItaDegrees: lightIta,
    clientHints: { healthyRingRgb: { r: 96, g: 68, b: 50 } },
  });

  assert.equal(mismatched.phototypeEstimate.profileMismatchTriggered, true);
  assert.ok(mismatched.phototypeEstimate.deltaItaFromProfile > 22);
});

test("Split-Vault PAD-DIQA returns Russian reason and 2 recovery tips on blur/glare/dark without technical jargon", () => {
  const rawJpeg = createSyntheticValidJpegBuffer();
  for (const issue of ["blur", "glare", "dark", "non_skin"]) {
    const res = inspectAndSanitizeSplitVault({
      bytes: rawJpeg,
      clientHints: { simulatedQualityIssue: issue },
    });
    assert.equal(res.qualityGate.passed, false);
    assert.equal(res.qualityGate.rejectCode, issue);
    assert.equal(res.qualityGate.recoveryTipsRu.length, 2);
  }
});

test("Medical claim safety guard blocks diagnosis, % probability, risk score, treatment, and mm while allowing safe routing copy", () => {
  assert.equal(
    checkPatientFacingMedicalClaimSafety(
      "На снимке определяются признаки неоднородности окраски контура, которые требуют очного осмотра дерматолога с дерматоскопией.",
    ).safe,
    true,
  );

  for (const unsafeText of [
    "У вас выявлена меланома кожи.",
    "Вероятность меланомы составляет 74%.",
    "Ваш балл риска: 8 из 10.",
    "Мажьте участок гормональной мазью 2 раза в день.",
    "Образование выросло на 6,4 мм за месяц.",
  ]) {
    assert.throws(() => assertPatientFacingCopySafe(unsafeText), /unsafe_medical_claim|безопасности/);
  }

  const stripped = stripForbiddenPublicFields({
    status: "ready",
    logits: [0.1, 2.4],
    classProbabilities: { melanoma: 0.82 },
    doctorOnlyStatusLocalisDraft: "secret",
    sanitizedFullImageS3Key: "s3://bucket/key.jpg",
    card: { safeSummaryRu: "ok", cbmConceptProbabilities: [0.5] },
  });
  assert.equal("logits" in stripped, false);
  assert.equal("classProbabilities" in stripped, false);
  assert.equal("doctorOnlyStatusLocalisDraft" in stripped, false);
  assert.equal("sanitizedFullImageS3Key" in stripped, false);
  assert.equal("cbmConceptProbabilities" in stripped.card, false);
  assert.equal(stripped.card.safeSummaryRu, "ok");
});
