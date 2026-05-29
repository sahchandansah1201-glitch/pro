import { describe, expect, it } from "vitest";

import {
  canSelfHostedSessionAccessPath,
  primarySelfHostedRole,
  selfHostedHomePath,
  selfHostedRoleLabel,
  selfHostedRoles,
} from "@/lib/self-hosted-role";
import type { SelfHostedApiSession } from "@/lib/self-hosted-api-session";

function session(roles: string[]): Pick<SelfHostedApiSession, "user"> {
  return {
    user: {
      id: "u-1",
      displayName: "Production Doctor",
      roles,
    },
  };
}

describe("self-hosted-role", () => {
  it("normalizes known backend roles and drops unknown values", () => {
    expect(selfHostedRoles(session(["doctor", "unknown", "doctor", "system_admin"]))).toEqual([
      "doctor",
      "system_admin",
    ]);
  });

  it("derives primary role, label, and home path", () => {
    const value = session(["system_admin"]);
    expect(primarySelfHostedRole(value)).toBe("system_admin");
    expect(selfHostedRoleLabel(value)).toBe("Системный администратор");
    expect(selfHostedHomePath(value)).toBe("/sys/users");
  });

  it("checks route access against every backend role", () => {
    expect(canSelfHostedSessionAccessPath(session(["doctor"]), "/desk")).toBe(true);
    expect(canSelfHostedSessionAccessPath(session(["doctor"]), "/reports")).toBe(true);
    expect(canSelfHostedSessionAccessPath(session(["private_doctor"]), "/reports")).toBe(true);
    expect(canSelfHostedSessionAccessPath(session(["clinic_admin"]), "/reports")).toBe(false);
    expect(canSelfHostedSessionAccessPath(session(["doctor"]), "/sys/users")).toBe(false);
    expect(canSelfHostedSessionAccessPath(session(["system_admin"]), "/sys/users")).toBe(true);
    expect(canSelfHostedSessionAccessPath(session(["unknown"]), "/desk")).toBe(false);
  });
});
