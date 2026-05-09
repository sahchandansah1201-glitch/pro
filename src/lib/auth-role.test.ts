import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { roleFromAuthUser } from "@/lib/auth-role";

function makeUser(meta: Partial<Pick<User, "app_metadata" | "user_metadata">>): User {
  return {
    id: "u",
    app_metadata: meta.app_metadata ?? {},
    user_metadata: meta.user_metadata ?? {},
    aud: "authenticated",
    created_at: "2025-01-01",
  } as unknown as User;
}

describe("roleFromAuthUser", () => {
  it("prefers app_metadata.role", () => {
    expect(
      roleFromAuthUser(
        makeUser({ app_metadata: { role: "clinic_admin" }, user_metadata: { role: "patient" } }),
      ),
    ).toBe("clinic_admin");
  });

  it("falls back to user_metadata.role when app_metadata missing", () => {
    expect(roleFromAuthUser(makeUser({ user_metadata: { role: "operator" } }))).toBe("operator");
  });

  it("falls back to doctor for unknown role", () => {
    expect(roleFromAuthUser(makeUser({ app_metadata: { role: "ceo" } }))).toBe("doctor");
  });

  it("falls back to doctor when user is null", () => {
    expect(roleFromAuthUser(null)).toBe("doctor");
  });
});
