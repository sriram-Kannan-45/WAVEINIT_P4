import { NextRequest, NextResponse } from "next/server";
import { readFile, stat, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

// In-memory cache for processed image variants
const imageCache = new Map<string, { buffer: Buffer; contentType: string }>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  try {
    const { slug } = await params;
    const testPicsDir = join(process.cwd(), "test", "pics");
    const targetFile = slug[slug.length - 1];

    // Check direct file or case-insensitive match
    let filePath = join(testPicsDir, ...slug);
    try {
      await stat(filePath);
    } catch {
      const files = await readdir(testPicsDir);
      const match = files.find(
        (f) => f.toLowerCase() === targetFile.toLowerCase(),
      );
      if (match) {
        filePath = join(testPicsDir, match);
      } else {
        return new NextResponse("File Not Found", { status: 404 });
      }
    }

    const { searchParams } = new URL(request.url);
    const requestedWidth = parseInt(searchParams.get("w") || "0", 10);
    const requestedQuality = parseInt(searchParams.get("q") || "80", 10);

    const cacheKey = `${filePath}_w${requestedWidth}_q${requestedQuality}`;
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey)!;
      return new NextResponse(cached.buffer as any, {
        status: 200,
        headers: {
          "Content-Type": cached.contentType,
          "Content-Length": cached.buffer.length.toString(),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    const rawBuffer = await readFile(filePath);

    // If svg or gif, return as-is
    if (ext === ".svg" || ext === ".gif") {
      return new NextResponse(rawBuffer, {
        status: 200,
        headers: {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Content-Length": rawBuffer.length.toString(),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // High performance optimization: resize full-frame camera photos (often 7-10MB, 24MP)
    // for blazing fast delivery without freezing or memory bloat.
    const targetWidth = requestedWidth > 0 ? requestedWidth : 1200;
    const quality = Math.min(Math.max(requestedQuality, 60), 90);

    let processedBuffer: Buffer;
    let contentType = MIME_TYPES[ext] || "image/jpeg";

    if (ext === ".png") {
      processedBuffer = await sharp(rawBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .png({ compressionLevel: 8 })
        .toBuffer();
    } else {
      processedBuffer = await sharp(rawBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .jpeg({ quality, progressive: true })
        .toBuffer();
      contentType = "image/jpeg";
    }

    // Store in cache (limit to 200 items in memory)
    if (imageCache.size > 200) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    imageCache.set(cacheKey, { buffer: processedBuffer, contentType });

    return new NextResponse(processedBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": processedBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
