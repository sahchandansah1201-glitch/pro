import { describe, expect, it } from "vitest";

import { filterExpectedHttpStatusConsoleErrors } from "../../e2e/live-admin-test-helpers";

describe("filterExpectedHttpStatusConsoleErrors", () => {
  it("removes only the allowed number of matching browser resource errors", () => {
    const errors = [
      "Failed to load resource: the server responded with a status of 409 ()",
      "Failed to load resource: the server responded with a status of 409 ()",
    ];

    expect(filterExpectedHttpStatusConsoleErrors(errors, 409, 1)).toEqual([errors[1]]);
  });

  it("preserves resource errors with another HTTP status", () => {
    const error = "Failed to load resource: the server responded with a status of 500 ()";

    expect(filterExpectedHttpStatusConsoleErrors([error], 409, 1)).toEqual([error]);
  });

  it("preserves non-resource console errors", () => {
    expect(filterExpectedHttpStatusConsoleErrors(["Unhandled application error"], 409, 1)).toEqual([
      "Unhandled application error",
    ]);
  });
});
