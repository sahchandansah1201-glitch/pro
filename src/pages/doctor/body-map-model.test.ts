import { describe, it, expect } from "vitest";
import {
  BODY_MAP_DEMO_NOW,
  BODY_MAP_VIEWS,
  bodyMapSurfaceBadge,
  bodyMapSurfaceHint,
  bodyMapSurfaceLabel,
  bodyMapVariantLabel,
  calcAgeAt,
  getBodyMapVariant,
  suggestBodyZone,
} from "./body-map-model";
import { getPatientById } from "@/lib/mock-data";

describe("body-map-model", () => {
  it("BODY_MAP_DEMO_NOW is the deterministic demo timestamp", () => {
    expect(BODY_MAP_DEMO_NOW).toBe("2026-05-04T00:00:00Z");
  });

  it("calcAgeAt is deterministic against demo now", () => {
    expect(calcAgeAt("1984-03-12")).toBe(42);
    expect(calcAgeAt("1965-05-30")).toBe(60); // birthday not yet reached
    expect(calcAgeAt("1965-05-04")).toBe(61);
    expect(calcAgeAt("2015-01-01")).toBe(11);
  });

  it("p-001 (female adult) maps to adult_female / Женщина", () => {
    const p = getPatientById("p-001")!;
    const v = getBodyMapVariant(p);
    expect(v).toBe("adult_female");
    expect(bodyMapVariantLabel(v)).toBe("Женщина");
  });

  it("p-004 (male adult) maps to adult_male / Мужчина", () => {
    const p = getPatientById("p-004")!;
    const v = getBodyMapVariant(p);
    expect(v).toBe("adult_male");
    expect(bodyMapVariantLabel(v)).toBe("Мужчина");
  });

  it("synthetic child female -> child_girl / Девочка", () => {
    const v = getBodyMapVariant({ sex: "female", birthDate: "2015-01-01" });
    expect(v).toBe("child_girl");
    expect(bodyMapVariantLabel(v)).toBe("Девочка");
  });

  it("synthetic child male -> child_boy / Мальчик", () => {
    const v = getBodyMapVariant({ sex: "male", birthDate: "2015-01-01" });
    expect(v).toBe("child_boy");
    expect(bodyMapVariantLabel(v)).toBe("Мальчик");
  });

  it("suggestBodyZone returns non-empty labels for every projection", () => {
    for (const view of BODY_MAP_VIEWS) {
      const z = suggestBodyZone(view, 0.5, 0.5);
      expect(typeof z).toBe("string");
      expect(z.length).toBeGreaterThan(0);
    }
    expect(suggestBodyZone("scalp", 0.5, 0.5)).toMatch(/головы/);
    expect(suggestBodyZone("left", 0.5, 0.6)).toMatch(/левая/);
    expect(suggestBodyZone("right", 0.5, 0.6)).toMatch(/правая/);
    expect(suggestBodyZone("front", 0.5, 0.05)).toMatch(/лицо/);
    expect(suggestBodyZone("back", 0.5, 0.05)).toMatch(/затылок/);
  });
});
