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
  it("does not grant a role from user editable metadata", () => {
    expect(roleFromAuthUser(makeUser({ user_metadata: { role: "system_admin" } }))).toBeNull();
  });
  it("prefers app_metadata.role", () => {
    expect(
      roleFromAuthUser(
        makeUser({ app_metadata: { role: "clinic_admin" }, user_metadata: { role: "patient" } }),
      ),
    ).toBe("clinic_admin");
  });

  it("keeps missing trusted metadata unassigned", () => {
    expect(roleFromAuthUser(makeUser({ user_metadata: { role: "operator" } }))).toBeNull();
  });

  it("keeps an unknown role unassigned", () => {
    expect(roleFromAuthUser(makeUser({ app_metadata: { role: "ceo" } }))).toBeNull();
  });

  it("has no role without a user", () => {
    expect(roleFromAuthUser(null)).toBeNull();
  });
});
