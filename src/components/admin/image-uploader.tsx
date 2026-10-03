"use client";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/app/admin/actions";
import { imageUrl } from "@/lib/utils";
import type { ProductImage } from "@/types";
async function prepare(file: File): Promise<File> {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw new Error("Choose a JPG, PNG, WebP, or AVIF image.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose an image smaller than 20 MB before optimization.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("Unable to optimize this image.");
  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
    type: "image/webp",
  });
}
export function ImageUploader({
  images,
  onChange,
  folder = "products",
  multiple = true,
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  folder?: "products" | "categories" | "collections" | "banners";
  multiple?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files).slice(
      0,
      multiple ? 20 - images.length : 1,
    );
    if (!selected.length) {
      toast.error("Use up to 20 images per product.");
      return;
    }
    setBusy(true);
    const urls = selected.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    const next = multiple ? [...images] : [];
    try {
      for (let i = 0; i < selected.length; i++) {
        setProgress(`Optimizing & uploading ${i + 1} of ${selected.length}…`);
        const file = await prepare(selected[i]);
        const form = new FormData();
        form.set("file", file);
        form.set("folder", folder);
        const r = await uploadImage(form);
        if (!r.ok) throw new Error(r.error);
        next.push({
          storage_path: r.path!,
          alt_text: "",
          sort_order: next.length,
          is_cover: next.length === 0,
        });
        onChange([...next]);
      }
      toast.success("Images uploaded. Save the form to attach them.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Image upload failed. Please retry.",
      );
    } finally {
      urls.forEach((u) => URL.revokeObjectURL(u));
      setPreviews([]);
      setBusy(false);
      setProgress("");
    }
  }
  function move(index: number, direction: number) {
    const next = [...images];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    onChange(next.map((img, i) => ({ ...img, sort_order: i })));
  }
  return (
    <div className="uploader">
      <label className="field">
        <span>
          {multiple ? "Product photographs" : "Cover photograph"} · JPG, PNG,
          WebP or AVIF
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={multiple}
          disabled={busy}
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="loading-label" aria-live="polite">
        {busy
          ? progress
          : "Images are optimized to 2048 px and validated before upload. Maximum 3 MB after optimization."}
      </p>
      <div className="upload-thumbnails">
        {previews.map((url, i) => (
          <div key={url} className="upload-thumb">
            <Image
              src={url}
              alt={`Selected upload ${i + 1}`}
              width={104}
              height={120}
              unoptimized
            />
            <span className="loading-label">Preparing…</span>
          </div>
        ))}
        {images.map((img, i) => (
          <div className="upload-thumb" key={img.storage_path}>
            <Image
              src={imageUrl(img.storage_path)}
              width={104}
              height={120}
              alt={img.alt_text || `Upload ${i + 1}`}
            />
            <input
              aria-label={`Alt text for image ${i + 1}`}
              value={img.alt_text}
              placeholder="Describe this image"
              onChange={(e) =>
                onChange(
                  images.map((v, j) =>
                    j === i ? { ...v, alt_text: e.target.value } : v,
                  ),
                )
              }
            />
            <div>
              {multiple && (
                <button
                  type="button"
                  aria-label={`Set image ${i + 1} as cover`}
                  onClick={() =>
                    onChange(
                      images.map((v, j) => ({ ...v, is_cover: j === i })),
                    )
                  }
                >
                  <Star size={13} fill={img.is_cover ? "#d6af5c" : "none"} />
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => {
                  const next = images.filter((_, j) => i !== j);
                  onChange(
                    next.map((v, j) => ({
                      ...v,
                      sort_order: j,
                      is_cover: img.is_cover ? j === 0 : v.is_cover,
                    })),
                  );
                }}
              >
                <Trash2 size={12} />
              </button>
              {multiple && (
                <>
                  <button
                    type="button"
                    disabled={!i}
                    aria-label={`Move image ${i + 1} earlier`}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowLeft size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={i === images.length - 1}
                    aria-label={`Move image ${i + 1} later`}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowRight size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
