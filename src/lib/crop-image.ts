export type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function tryLoadImage(src: string, useCors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (useCors) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load image from source: ${src.slice(0, 100)}`));
    image.src = src;
    if (image.complete && image.naturalWidth > 0) {
      resolve(image);
    }
  });
}

/**
 * Loads an image from a URL or File with robust CORS and encoding fallbacks.
 */
export async function createImage(url: string): Promise<HTMLImageElement> {
  // If the URL contains unencoded spaces (e.g. "/pic/Elegant Emerald Green..."), encode it safely
  const cleanUrl = url.includes(" ") ? encodeURI(url) : url;

  // If it's a blob: or data: URL, load directly (no cross-origin restrictions apply)
  if (cleanUrl.startsWith("blob:") || cleanUrl.startsWith("data:")) {
    return tryLoadImage(cleanUrl, false);
  }

  // If it's a local relative path (e.g. "/pic/..." or "/brand/..."), load directly
  if (cleanUrl.startsWith("/")) {
    return tryLoadImage(cleanUrl, false);
  }

  // For remote URLs (http:// or https://), first try loading with CORS enabled and a cache-buster parameter
  // to avoid browser cache collisions with non-CORS cached elements from earlier renders
  try {
    const separator = cleanUrl.includes("?") ? "&" : "?";
    const corsUrl = `${cleanUrl}${separator}_crop_cors=1`;
    return await tryLoadImage(corsUrl, true);
  } catch {
    // If cache-busted CORS fails, try fetching as a Blob to bypass CORS cache restrictions
    try {
      const response = await fetch(cleanUrl, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const img = await tryLoadImage(blobUrl, false);
        return img;
      }
    } catch {
      // Fetch failed, continue to fallback
    }

    // Last resort: attempt direct load without CORS
    return await tryLoadImage(cleanUrl, false);
  }
}

/**
 * Returns a cropped File from an image URL and pixel crop coordinates.
 * High-resolution canvas extraction with clamped boundaries and multi-format fallback.
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

  const imgW = image.naturalWidth || image.width;
  const imgH = image.naturalHeight || image.height;

  if (!imgW || !imgH) {
    throw new Error("Unable to read image dimensions from source.");
  }

  // Clamp source crop to within valid source image boundaries to prevent IndexSizeError
  const sx = Math.max(0, Math.min(Math.round(pixelCrop.x), imgW - 1));
  const sy = Math.max(0, Math.min(Math.round(pixelCrop.y), imgH - 1));
  const sw = Math.max(1, Math.min(Math.round(pixelCrop.width), imgW - sx));
  const sh = Math.max(1, Math.min(Math.round(pixelCrop.height), imgH - sy));

  // Cap canvas to maxDimension for performance and storage efficiency
  const maxSide = Math.max(sw, sh);
  const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;

  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));

  // Enable high quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    try {
      // Export with optimized quality 0.86 for fast upload and boutique fabric clarity
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Adaptive compression if file size nears the 3 MB upload ceiling
            if (blob.size > 2600000) {
              try {
                canvas.toBlob(
                  (compressedBlob) => {
                    const finalBlob = compressedBlob || blob;
                    const cleanName = fileName.replace(/\.[^.]+$/, "") + ".webp";
                    const file = new File([finalBlob], cleanName, { type: "image/webp" });
                    const blobUrl = URL.createObjectURL(finalBlob);
                    resolve({ file, blobUrl });
                  },
                  "image/webp",
                  0.78,
                );
                return;
              } catch {
                // If secondary compression fails, proceed with initial blob
              }
            }

            const cleanName = fileName.replace(/\.[^.]+$/, "") + ".webp";
            const file = new File([blob], cleanName, { type: "image/webp" });
            const blobUrl = URL.createObjectURL(blob);
            resolve({ file, blobUrl });
            return;
          }

          // Fallback to JPEG if WebP export is not supported or returns null
          canvas.toBlob(
            (jpegBlob) => {
              if (!jpegBlob) {
                reject(
                  new Error(
                    "Canvas crop failed to produce an image blob in WebP or JPEG formats.",
                  ),
                );
                return;
              }
              const cleanName = fileName.replace(/\.[^.]+$/, "") + ".jpg";
              const file = new File([jpegBlob], cleanName, { type: "image/jpeg" });
              const blobUrl = URL.createObjectURL(jpegBlob);
              resolve({ file, blobUrl });
            },
            "image/jpeg",
            0.88,
          );
        },
        "image/webp",
        0.86,
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
