"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Trash2, Star, Crop } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/app/admin/actions";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { ImageCropperModal } from "./image-cropper-modal";
import { imageUrl } from "@/lib/utils";
import type { ProductImage } from "@/types";

async function prepare(file: File): Promise<File> {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
  )
    throw new Error("Choose a JPG, PNG, WebP, or AVIF image.");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Choose an image smaller than 25 MB before optimization.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.92),
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
  defaultAspect,
  cropShape = "rect",
  modalTitle,
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  folder?: "products" | "categories" | "collections" | "banners";
  multiple?: boolean;
  defaultAspect?: number;
  cropShape?: "rect" | "round";
  modalTitle?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  // Cropper queue state
  const [pendingQueue, setPendingQueue] = useState<File[]>([]);
  const [cropTarget, setCropTarget] = useState<{
    imageSrc: string;
    fileName: string;
    isRecrop?: boolean;
    recropIndex?: number;
    rawFile?: File;
  } | null>(null);

  /**
   * Directly upload a prepared or cropped File object to storage
   */
  async function performUpload(fileToUpload: File, recropIndex?: number) {
    setBusy(true);
    try {
      setProgress("Uploading optimized & cropped image…");
      const form = new FormData();
      form.set("file", fileToUpload);
      form.set("folder", folder);

      const r = await uploadImage(form);
      if (!r.ok || !r.path) {
        throw new Error(r.error || "Upload failed.");
      }

      if (typeof recropIndex === "number" && recropIndex >= 0) {
        // Replace existing image path
        const next = images.map((img, idx) =>
          idx === recropIndex ? { ...img, storage_path: r.path! } : img,
        );
        onChange(next);
        toast.success("Image recropped and updated successfully.");
      } else {
        // Append new image
        const next = multiple ? [...images] : [];
        next.push({
          storage_path: r.path,
          alt_text: "",
          sort_order: next.length,
          is_cover: next.length === 0,
        });
        onChange(next);
        toast.success("Image cropped & uploaded. Save the form to attach it.");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Image upload failed. Please retry.",
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  /**
   * Initiates upload queue and opens cropper modal on the first image
   */
  function handleFileSelect(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files).slice(
      0,
      multiple ? 20 - images.length : 1,
    );
    if (!selected.length) {
      toast.error("Maximum 20 images reached for this product.");
      return;
    }

    for (const f of selected) {
      if (
        !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(f.type)
      ) {
        toast.error("Please choose JPG, PNG, WebP, or AVIF images only.");
        return;
      }
      if (f.size > 25 * 1024 * 1024) {
        toast.error("File size must be under 25 MB.");
        return;
      }
    }

    const [first, ...rest] = selected;
    setPendingQueue(rest);
    const objectUrl = URL.createObjectURL(first);
    setCropTarget({
      imageSrc: objectUrl,
      fileName: first.name,
      rawFile: first,
    });
  }

  /**
   * Advances to next queued image or completes crop session
   */
  function proceedToNextInQueue() {
    if (pendingQueue.length > 0) {
      const [nextFile, ...rest] = pendingQueue;
      setPendingQueue(rest);
      const objectUrl = URL.createObjectURL(nextFile);
      setCropTarget({
        imageSrc: objectUrl,
        fileName: nextFile.name,
        rawFile: nextFile,
      });
    } else {
      setCropTarget(null);
    }
  }

  /**
   * Admin confirmed crop in modal
   */
  async function handleCropConfirm(croppedFile: File, croppedBlobUrl: string) {
    const isRecrop = cropTarget?.isRecrop;
    const recropIndex = cropTarget?.recropIndex;

    // Clean up current object URL if created locally
    if (cropTarget?.imageSrc && cropTarget.imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(cropTarget.imageSrc);
    }
    URL.revokeObjectURL(croppedBlobUrl);

    // Upload cropped file
    await performUpload(croppedFile, isRecrop ? recropIndex : undefined);

    // If not recropping, proceed through any remaining files in batch
    if (!isRecrop) {
      proceedToNextInQueue();
    } else {
      setCropTarget(null);
    }
  }

  /**
   * Admin opted to skip cropping this specific image
   */
  async function handleCropSkip() {
    if (!cropTarget?.rawFile) {
      setCropTarget(null);
      return;
    }
    const rawFile = cropTarget.rawFile;
    if (cropTarget.imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(cropTarget.imageSrc);
    }
    try {
      const preparedFile = await prepare(rawFile);
      await performUpload(preparedFile);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    }
    proceedToNextInQueue();
  }

  /**
   * Admin cancelled the crop modal
   */
  function handleCropCancel() {
    if (cropTarget?.imageSrc && cropTarget.imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(cropTarget.imageSrc);
    }
    // Discard any remaining queued files without mutating form
    setPendingQueue([]);
    setCropTarget(null);
    toast.info("Crop operation cancelled.");
  }

  /**
   * Re-crop an existing uploaded image
   */
  function handleRecropExisting(index: number) {
    const targetImg = images[index];
    if (!targetImg?.storage_path) return;
    const resolvedUrl = imageUrl(targetImg.storage_path);
    setCropTarget({
      imageSrc: resolvedUrl,
      fileName: `recrop-${index + 1}.webp`,
      isRecrop: true,
      recropIndex: index,
    });
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
            handleFileSelect(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="loading-label" aria-live="polite">
        {busy
          ? progress
          : "Images are framed and cropped to match storefront display areas before upload. Maximum 25 MB."}
      </p>

      {/* Cropper Modal */}
      {cropTarget && (
        <ImageCropperModal
          imageSrc={cropTarget.imageSrc}
          fileName={cropTarget.fileName}
          folder={folder}
          cropShape={cropShape}
          defaultAspect={defaultAspect}
          title={
            cropTarget.isRecrop
              ? `Re-crop Image ${(cropTarget.recropIndex ?? 0) + 1}`
              : modalTitle ||
                `Crop & Frame Image ${pendingQueue.length > 0 ? `(1 of ${pendingQueue.length + 1})` : ""}`
          }
          onConfirm={handleCropConfirm}
          onSkip={!cropTarget.isRecrop ? handleCropSkip : undefined}
          onCancel={handleCropCancel}
        />
      )}

      <div className="upload-thumbnails">
        {images.map((img, i) => (
          <div className="upload-thumb" key={img.storage_path}>
            <OptimizedImage
              src={img.storage_path}
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
              {/* Re-crop Button */}
              <button
                type="button"
                className="recrop-btn"
                title="Adjust crop & framing"
                aria-label={`Re-crop image ${i + 1}`}
                onClick={() => handleRecropExisting(i)}
              >
                <Crop size={12} />
              </button>

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
