import sharp from "sharp";
export class ImageValidationError extends Error {}
export async function validateUploadFile(file: unknown) {
  if (!(file instanceof File) || file.size === 0 || file.size > 3145728)
    throw new ImageValidationError(
      "Choose an image smaller than 3 MB after optimization.",
    );
  const types: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  if (!types[file.type])
    throw new ImageValidationError("Choose a JPG, PNG, WebP, or AVIF image.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const magic =
    file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.type === "image/webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          : bytes.toString("ascii", 4, 8) === "ftyp" &&
            /avif|avis/.test(bytes.toString("ascii", 8, 40));
  if (!magic)
    throw new ImageValidationError(
      "The file content does not match a supported image.",
    );
  try {
    const meta = await sharp(bytes, { limitInputPixels: 16777216 }).metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 16777216 ||
      (meta.pages || 1) > 1
    )
      throw new Error();
  } catch {
    throw new ImageValidationError(
      "Choose a valid, non-animated image with at most 16 megapixels.",
    );
  }
  return { bytes, extension: types[file.type], contentType: file.type };
}
