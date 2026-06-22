import { afterEach, describe, expect, it, vi } from "vitest";

import { createAdminPrivatePractice } from "@/lib/self-hosted-admin-api";

describe("self-hosted-admin-api · private practice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a private practice owner with clinic admin and private doctor roles", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stage: "6A",
          source: "postgres",
          item: {
            clinic: {
              id: "clinic-1",
              name: "Кабинет Морозова",
              slug: "morozov",
              timezone: "Europe/Moscow",
              createdAt: "2026-06-22T00:00:00.000Z",
              usersCount: 2,
            },
            owner: {
              id: "user-1",
              email: "owner@example.test",
              displayName: "Морозов Дмитрий Игоревич",
              active: true,
              createdAt: "2026-06-22T00:00:00.000Z",
              roles: [
                { role: "clinic_admin", clinicId: "clinic-1", clinicName: "Кабинет Морозова", clinicSlug: "morozov" },
                { role: "private_doctor", clinicId: "clinic-1", clinicName: "Кабинет Морозова", clinicSlug: "morozov" },
              ],
            },
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createAdminPrivatePractice({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-admin",
      payload: {
        clinicName: "Кабинет Морозова",
        slug: "morozov",
        timezone: "Europe/Moscow",
        ownerDisplayName: "Морозов Дмитрий Игоревич",
        ownerEmail: "owner@example.test",
        ownerPassword: "long-password-1",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.clinic.name).toBe("Кабинет Морозова");
    expect(result.value?.owner.roles.map((role) => role.role)).toEqual(["clinic_admin", "private_doctor"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/private-practices",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Bearer token-admin",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          clinicName: "Кабинет Морозова",
          slug: "morozov",
          timezone: "Europe/Moscow",
          ownerDisplayName: "Морозов Дмитрий Игоревич",
          ownerEmail: "owner@example.test",
          ownerPassword: "long-password-1",
        }),
      }),
    );
  });
});
