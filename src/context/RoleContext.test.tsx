import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { RoleProvider } from "./RoleContext";
import { useRole } from "./role-context";
import { writeSelfHostedApiSession, clearSelfHostedApiSession } from "@/lib/self-hosted-api-session";

function Identity() {
  const value = useRole();
  return <div data-testid="identity">{JSON.stringify(value)}</div>;
}

beforeEach(() => window.localStorage.clear());
describe("readonly working identity", () => {
  it("has no role or fixture user from stale training storage", () => {
    window.localStorage.setItem("derma-pro:demo-role", "system_admin");
    render(<RoleProvider><Identity /></RoleProvider>);
    const identity = JSON.parse(screen.getByTestId("identity").textContent ?? "{}");
    expect(identity.role).toBeNull();
    expect(identity.currentUser).toBeNull();
  });

  it("updates only from the working session and clears identity on logout", () => {
    render(<RoleProvider><Identity /></RoleProvider>);
    act(() => writeSelfHostedApiSession({ apiToken: "synthetic-test-token", user: {
      id: "synthetic-admin", displayName: "Тестовый сотрудник", roles: ["clinic_admin", "private_doctor"],
    } }));
    const assigned = JSON.parse(screen.getByTestId("identity").textContent ?? "{}");
    expect(assigned.roles).toEqual(["clinic_admin", "private_doctor"]);
    expect(assigned.currentUser.id).toBe("synthetic-admin");
    expect(assigned.setRole).toBeUndefined();
    act(() => clearSelfHostedApiSession());
    expect(JSON.parse(screen.getByTestId("identity").textContent ?? "{}").currentUser).toBeNull();
  });
});
