import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleContext } from "@/context/role-context";
import { DEMO_USERS } from "@/lib/users";
import { PatientPortalAccessCard } from "@/pages/doctor/PatientPortalAccessCard";
import { VisitPrevisitCaseCard } from "@/pages/doctor/VisitPrevisitCaseCard";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stage 7 role-gated clinical previsit & portal access cards", () => {
  it("hides VisitPrevisitCaseCard and PatientPortalAccessCard from assistant role", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { container } = render(
      <RoleContext.Provider
        value={{
          role: "assistant",
          setRole: () => {},
          label: "Ассистент",
          currentUser: DEMO_USERS.assistant,
        }}
      >
        <VisitPrevisitCaseCard visitId="30000000-0000-4000-8000-000000000001" />
        <PatientPortalAccessCard patientId="20000000-0000-4000-8000-000000000001" />
      </RoleContext.Provider>,
    );

    await waitFor(() => {
      expect(container.textContent).toBe("");
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
