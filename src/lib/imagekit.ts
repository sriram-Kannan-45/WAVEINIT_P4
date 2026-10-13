export const IMAGEKIT_URL_ENDPOINT = (
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ||
  "https://ik.imagekit.io/9nwmg4m7o"
).replace(/\/+$/, "");

export type ImageKitTransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "avif" | "jpg" | "png";
  blur?: number;
  crop?: "maintain_ratio" | "force" | "at_max" | "pad_resize";
};

export function isImageKitUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith("https://ik.imagekit.io/") ||
    url.startsWith("http://ik.imagekit.io/") ||
    url.includes("ik.imagekit.io/")
  );
}

/**
 * Builds an ImageKit delivery URL with WebP/AVIF auto-format negotiation,
 * responsive dimensions, and quality compression parameters.
 */
export function buildImageKitUrl(
  pathOrUrl: string,
  options?: ImageKitTransformOptions,
): string {
  if (!pathOrUrl) return "";

  // If it's already an absolute ImageKit URL
  let baseUrl = pathOrUrl;
  if (!isImageKitUrl(pathOrUrl)) {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      // Non-ImageKit external URL
      return pathOrUrl;
    }
    // Clean relative path and combine with endpoint
    const cleanPath = pathOrUrl.replace(/^\/+/, "");
    baseUrl = `${IMAGEKIT_URL_ENDPOINT}/${cleanPath}`;
  }

  // Parse existing URL to separate origin+path and query
  const [urlWithoutQuery, existingQuery] = baseUrl.split("?");
  const queryParams = new URLSearchParams(existingQuery || "");

  // Build transformation string (tr=...)
  const trParts: string[] = [];

  // Default to automatic modern format negotiation (WebP / AVIF based on browser Accept header)
  const format = options?.format ?? "auto";
  if (format) {
    trParts.push(`f-${format}`);
  }

  // Quality compression (default 80 if not provided)
  const quality = options?.quality ?? 80;
  if (quality) {
    trParts.push(`q-${quality}`);
  }

  if (options?.width && options.width > 0) {
    trParts.push(`w-${Math.round(options.width)}`);
  }

  if (options?.height && options.height > 0) {
    trParts.push(`h-${Math.round(options.height)}`);
  }

  if (options?.crop) {
    trParts.push(`c-${options.crop}`);
  }

  if (options?.blur && options.blur > 0) {
    trParts.push(`bl-${Math.round(options.blur)}`);
  }

  if (trParts.length > 0) {
    const trString = trParts.join(",");
    // If there is an existing tr in query params, don't clobber unless overriding
    if (!queryParams.has("tr")) {
      queryParams.set("tr", trString);
    }
  }

  const queryString = queryParams.toString().replace(/%2C/g, ",");
  return queryString ? `${urlWithoutQuery}?${queryString}` : urlWithoutQuery;
}

/**
 * Generates a low-quality image placeholder (LQIP) URL for smooth blur-up transitions.
 */
export function getImageKitPlaceholderUrl(pathOrUrl: string): string {
  return buildImageKitUrl(pathOrUrl, {
    width: 24,
    quality: 20,
    blur: 6,
    format: "auto",
  });
}

/**
 * Next.js Image loader for ImageKit delivery.
 */
export function imageKitLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (src.startsWith("/")) {
    // Local assets remain local
    return src;
  }
  return buildImageKitUrl(src, {
    width,
    quality: quality || 80,
    format: "auto",
  });
}

export type ImageKitUploadResult = {
  fileId: string;
  name: string;
  url: string;
  filePath: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  size?: number;
};

/**
 * Server-side upload function for ImageKit.
 * Keeps private API key securely on the backend. Never exposed to client.
 */
export async function uploadToImageKit({
  fileBytes,
  fileName,
  folder = "products",
  tags = ["boutique"],
}: {
  fileBytes: Buffer | Uint8Array;
  fileName: string;
  folder?: string;
  tags?: string[];
}): Promise<ImageKitUploadResult> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error(
      "IMAGEKIT_PRIVATE_KEY is not configured on the server. Please add it to environment variables.",
    );
  }

  const uploadEndpoint = "https://upload.imagekit.io/api/v1/files/upload";
  const authHeader = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

  const base64File = Buffer.isBuffer(fileBytes)
    ? fileBytes.toString("base64")
    : Buffer.from(fileBytes).toString("base64");

  const cleanFolder = folder.startsWith("/") ? folder : `/${folder}`;

  const formData = new FormData();
  formData.append("file", base64File);
  formData.append("fileName", fileName);
  formData.append("folder", cleanFolder);
  formData.append("useUniqueFileName", "true");
  if (tags && tags.length > 0) {
    formData.append("tags", tags.join(","));
  }

  const response = await fetch(uploadEndpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      parsedMessage = json.message || json.help || errorBody;
    } catch {
      // Keep raw message
    }
    throw new Error(`ImageKit upload failed (${response.status}): ${parsedMessage}`);
  }

  const result = (await response.json()) as ImageKitUploadResult;
  return result;
}

/**
 * Verifies that a remote image URL is accessible via HTTP HEAD/GET without errors.
 */
export async function verifyRemoteImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "AchuBoutique-ImageKit-Verifier/1.0",
      },
    });
    if (res.ok) return true;
    // Fall back to GET with Range 0-0 in case HEAD is blocked by CDN
    const getRes = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
        "User-Agent": "AchuBoutique-ImageKit-Verifier/1.0",
      },
    });
    return getRes.ok;
  } catch {
    return false;
  }
}
