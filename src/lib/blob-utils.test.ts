import { describe, expect, it } from "vitest";

import { blobFromParts, bytesToBlobPart } from "./blob-utils";

describe("blob-utils", () => {
  it("copies a Uint8Array slice into an ArrayBuffer-safe BlobPart", () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const slice = source.subarray(1, 3);

    const part = bytesToBlobPart(slice);

    expect(part).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(part as ArrayBuffer))).toEqual([2, 3]);
  });

  it("builds blobs from strings and byte arrays without exposing typed-array generics", () => {
    const blob = blobFromParts(["A", new Uint8Array([66])], "text/plain");

    expect(blob.type).toBe("text/plain");
    expect(blob.size).toBe(2);
  });
});
