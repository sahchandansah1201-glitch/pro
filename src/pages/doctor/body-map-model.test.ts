import { describe, it, expect } from "vitest";
import {
  BODY_MAP_DEMO_NOW,
  BODY_MAP_VIEWS,
  bodyMapSurfaceBadge,
  bodyMapSurfaceHint,
  bodyMapSurfaceLabel,
  bodyMapProfileLabel,
  calcAgeAt,
  getBodyMapProfile,
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

  it("p-001 maps to the adult female profile", () => {
    const p = getPatientById("p-001")!;
    const profile = getBodyMapProfile(p);
    expect(profile).toEqual({ sex: "female", ageBand: "adult" });
    expect(bodyMapProfileLabel(profile)).toBe("Женщина · 18–64 года");
  });

  it("p-004 maps to the adult male profile", () => {
    const p = getPatientById("p-004")!;
    const profile = getBodyMapProfile(p);
    expect(profile).toEqual({ sex: "male", ageBand: "adult" });
    expect(bodyMapProfileLabel(profile)).toBe("Мужчина · 18–64 года");
  });

  it("does not choose a body model when sex or birth date is unusable", () => {
    expect(getBodyMapProfile({ sex: null, birthDate: "1990-01-01" })).toBeNull();
    expect(getBodyMapProfile({ sex: "female", birthDate: null })).toBeNull();
    expect(getBodyMapProfile({ sex: "female", birthDate: "not-a-date" })).toBeNull();
    expect(getBodyMapProfile({ sex: "female", birthDate: "2024-02-30" })).toBeNull();
    expect(getBodyMapProfile({ sex: "male", birthDate: "2027-01-01" })).toBeNull();
  });

  it("selects all seven age-specific atlas profiles", () => {
    expect(getBodyMapProfile({ sex: "female", birthDate: "2025-08-01" })).toEqual({
      sex: "female",
      ageBand: "infant",
    });
    expect(getBodyMapProfile({ sex: "male", birthDate: "2023-01-01" })).toEqual({
      sex: "male",
      ageBand: "early_child",
    });
    expect(getBodyMapProfile({ sex: "female", birthDate: "2018-01-01" })).toEqual({
      sex: "female",
      ageBand: "child",
    });
    expect(getBodyMapProfile({ sex: "male", birthDate: "2013-01-01" })).toEqual({
      sex: "male",
      ageBand: "adolescent",
    });
    expect(getBodyMapProfile({ sex: "female", birthDate: "2010-01-01" })).toEqual({
      sex: "female",
      ageBand: "late_adolescent",
    });
    expect(getBodyMapProfile({ sex: "male", birthDate: "1990-01-01" })).toEqual({
      sex: "male",
      ageBand: "adult",
    });
    expect(getBodyMapProfile({ sex: "female", birthDate: "1940-01-01" })).toEqual({
      sex: "female",
      ageBand: "older_adult",
    });
  });

  it("uses native Russian age labels without sexualising young children", () => {
    expect(bodyMapProfileLabel({ sex: "female", ageBand: "infant" })).toBe(
      "Младенец · девочка · до 1 года",
    );
    expect(bodyMapProfileLabel({ sex: "male", ageBand: "early_child" })).toBe(
      "Ребёнок · мальчик · 1–4 года",
    );
    expect(bodyMapProfileLabel({ sex: "female", ageBand: "child" })).toBe(
      "Ребёнок · девочка · 5–9 лет",
    );
    expect(bodyMapProfileLabel({ sex: "male", ageBand: "adolescent" })).toBe(
      "Подросток · мальчик · 10–14 лет",
    );
    expect(bodyMapProfileLabel({ sex: "female", ageBand: "late_adolescent" })).toBe(
      "Подросток · девушка · 15–17 лет",
    );
    expect(bodyMapProfileLabel({ sex: "male", ageBand: "adult" })).toBe(
      "Мужчина · 18–64 года",
    );
    expect(bodyMapProfileLabel({ sex: "female", ageBand: "older_adult" })).toBe(
      "Женщина · 65 лет и старше",
    );
  });

  it("surface labels, hints and badges cover all five projections", () => {
    expect(bodyMapSurfaceLabel("front")).toBe("Передняя поверхность");
    expect(bodyMapSurfaceLabel("back")).toBe("Задняя поверхность");
    expect(bodyMapSurfaceLabel("left")).toBe("Левая боковая поверхность");
    expect(bodyMapSurfaceLabel("right")).toBe("Правая боковая поверхность");
    expect(bodyMapSurfaceLabel("scalp")).toBe("Верх головы");

    expect(bodyMapSurfaceBadge("front")).toBe("ПЕРЕД");
    expect(bodyMapSurfaceBadge("back")).toBe("СПИНА");
    expect(bodyMapSurfaceBadge("left")).toBe("ЛЕВЫЙ БОК");
    expect(bodyMapSurfaceBadge("right")).toBe("ПРАВЫЙ БОК");
    expect(bodyMapSurfaceBadge("scalp")).toBe("ГОЛОВА");

    expect(bodyMapSurfaceHint("front")).toMatch(/лицо/);
    expect(bodyMapSurfaceHint("back")).toMatch(/лопатки/);
    expect(bodyMapSurfaceHint("back")).toMatch(/позвоночник/);
  });
});
