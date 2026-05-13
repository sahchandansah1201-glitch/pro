export type BlobByteInput = Uint8Array;

export type SafeBlobPart = string | BlobByteInput;

export function bytesToBlobPart(bytes: BlobByteInput): BlobPart {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function blobFromParts(
  parts: readonly SafeBlobPart[],
  type: string,
): Blob {
  return new Blob(
    parts.map((part) =>
      typeof part === "string" ? part : bytesToBlobPart(part),
    ),
    { type },
  );
}
