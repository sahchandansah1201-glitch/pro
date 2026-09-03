import { describe, expect, it } from "vitest";

import { selfHostedPublicErrorText } from "./self-hosted-public-error";

describe("selfHostedPublicErrorText · body atlas recovery", () => {
  it("turns atlas contract details into native Russian recovery copy", () => {
    expect(selfHostedPublicErrorText({
      code: "validation_error",
      status: 422,
      details: [{
        field: "bodyMap.atlasProfileId",
        message: "bodyMap.atlasProfileId does not match the patient profile at visit time.",
      }],
    })).toBe("Модель тела не совпадает с данными пациента или настройками системы. Обновите страницу и поставьте точку заново.");

    expect(selfHostedPublicErrorText({
      code: "validation_error",
      status: 422,
      details: [{
        field: "bodyMap.regionId",
        message: "The body-map point is outside the claimed region.",
      }],
    })).toBe("Точка находится вне выбранной области. Выберите область на модели и поставьте точку заново.");
  });

  it("never returns unknown server text or validation details to the interface", () => {
    expect(selfHostedPublicErrorText({
      code: "internal_error",
      message: "backend failed at https://private.invalid/?token=secret",
    }, "Действие не выполнено.")).toBe("Действие не выполнено.");

    expect(selfHostedPublicErrorText({
      code: "validation_error",
      details: [{ field: "unknown", message: "storage_object_path=/private/patient" }],
    })).toBe("Проверьте заполненные данные и повторите действие.");
  });
});
