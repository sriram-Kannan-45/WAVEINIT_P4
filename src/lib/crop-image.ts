export type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Loads an image from a URL or File with CORS enabled.
 */
export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    // If it's a remote URL, allow cross-origin requests for canvas export
    if (url.startsWith("http://") || url.startsWith("https://")) {
      image.crossOrigin = "anonymous";
    }
    image.src = url;
  });
}

/**
 * Returns a cropped File from an image URL and pixel crop coordinates.
 * High-resolution canvas extraction with WebP encoding (quality 0.92).
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string = "cropped-image.webp",
  maxDimension: number = 2048,
): Promise<{ file: File; blobUrl: string }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D rendering context is not available.");
  }

  // Ensure safe positive dimensions
  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));

  // Cap canvas to maxDimension for performance and storage efficiency
  const maxSide = Math.max(cropW, cropH);
  const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;

  canvas.width = Math.round(cropW * scale);
  canvas.height = Math.round(cropH * scale);

  // Enable high quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas crop failed to produce an image blob."));
          return;
        }
        const cleanName = fileName.replace(/\.[^.]+$/, "") + ".webp";
        const file = new File([blob], cleanName, { type: "image/webp" });
        const blobUrl = URL.createObjectURL(blob);
        resolve({ file, blobUrl });
      },
      "image/webp",
      0.92,
    );
  });
}
