import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSelfHostedClinicalFollowUpMessage,
  createSelfHostedPatientFollowUpMessage,
  createSelfHostedVisitFollowUp,
  listSelfHostedClinicalFollowUps,
  listSelfHostedPatientFollowUps,
  toSelfHostedClinicalFollowUp,
  updateSelfHostedClinicalFollowUp,
} from "./self-hosted-follow-up-api";

const FOLLOW_UP = {
  id: "fu-1",
  visitId: "visit-1",
  dueAt: "2026-05-30T10:00:00.000Z",
  status: "sent",
  priority: "high",
  reason: "Контроль",
  patientSummary: "Пациент увидит это",
  internalNote: "Doctor-only",
  messageCount: 1,
  latestMessage: {
    id: "message-1",
    followUpId: "fu-1",
    senderRole: "doctor",
    direction: "clinic_to_patient",
    body: "Напоминание",
    patientVisible: true,
  },
};

describe("self-hosted follow-up API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes follow-up DTOs and messages", () => {
    const item = toSelfHostedClinicalFollowUp(FOLLOW_UP);
    expect(item.id).toBe("fu-1");
    expect(item.status).toBe("sent");
    expect(item.priority).toBe("high");
    expect(item.latestMessage?.body).toBe("Напоминание");
    expect(item.internalNote).toBe("Doctor-only");
  });

  it("lists staff and patient follow-ups with bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [FOLLOW_UP] }),
    } as Response);

    const staff = await listSelfHostedClinicalFollowUps({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "token",
      status: "sent",
      visitId: "visit-1",
    });
    const patient = await listSelfHostedPatientFollowUps({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "token",
    });

    expect(staff.ok).toBe(true);
    expect(patient.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/clinical/follow-ups?status=sent&visitId=visit-1");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/me/follow-ups");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer token" });
  });

  it("creates, updates, and messages follow-ups", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ item: FOLLOW_UP }),
    } as Response);
    const args = { apiBaseUrl: "http://localhost:3001", apiToken: "token" };

    await createSelfHostedVisitFollowUp({
      ...args,
      visitId: "visit-1",
      payload: { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
    });
    await updateSelfHostedClinicalFollowUp({
      ...args,
      followUpId: "fu-1",
      payload: { status: "completed" },
    });
    await createSelfHostedClinicalFollowUpMessage({
      ...args,
      followUpId: "fu-1",
      payload: { body: "Готово" },
    });
    await createSelfHostedPatientFollowUpMessage({
      ...args,
      followUpId: "fu-1",
      payload: { body: "Спасибо" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/visits/visit-1/follow-ups");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[2][0]).toContain("/api/v1/clinical/follow-ups/fu-1/messages");
    expect(fetchMock.mock.calls[3][0]).toContain("/api/v1/me/follow-ups/fu-1/messages");
  });

  it("returns not_configured without a token", async () => {
    const result = await listSelfHostedPatientFollowUps({ apiBaseUrl: "/api", apiToken: null });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });
});
