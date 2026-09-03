import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClinicalImage } from "@/lib/domain";
import { ClinicalImagePreview } from "./ClinicalImagePreview";

const image = (id: string): ClinicalImage => ({
  id,
  visitId: "visit-1",
  lesionId: "lesion-1",
  kind: "dermoscopy",
  source: "file",
  capturedAt: "2026-09-02T08:00:00.000Z",
  deviceId: null,
  quality: { score: 0, issues: ["Техническое качество не оценено"] },
  exifMeta: { width: 0, height: 0 },
  storagePath: "",
});

describe("ClinicalImagePreview", () => {
  it("never renders the previous blob under new image metadata and revokes it", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, revokeObjectURL });
    const resolveDownloadUrl = vi.fn(async (assetId: string) => ({
      ok: true as const,
      value: {
        assetId,
        clinicId: "clinic-1",
        visitId: "visit-1",
        downloadUrl: `blob:${assetId}`,
        expiresIn: 300,
        expiresAt: "2026-09-02T08:05:00.000Z",
      },
      error: null,
    }));
    const common = {
      zoom: 1,
      title: "Основной",
      kindLabel: "Дерматоскопия",
      sourceLabel: "Файл",
      capturedAtLabel: "02.09.2026 08:00",
      resolveDownloadUrl,
    };

    const view = render(<ClinicalImagePreview image={image("asset-a")} {...common} />);
    expect(await screen.findByRole("img")).toHaveAttribute("src", "blob:asset-a");

    view.rerender(<ClinicalImagePreview image={image("asset-b")} {...common} />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Загружаем защищённый снимок/);
    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("src", "blob:asset-b");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:asset-a");
    });
  });
});
