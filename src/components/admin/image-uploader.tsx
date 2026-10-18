"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Trash2,
  Star,
  Crop,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/app/admin/actions";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { ImageCropperModal } from "./image-cropper-modal";
import { imageUrl } from "@/lib/utils";
import type { ProductImage } from "@/types";

export const VIEW_LABEL_OPTIONS = [
  { value: "", label: "General View (Default)" },
  { value: "Front View", label: "Front View" },
  { value: "Back View", label: "Back View" },
  { value: "Left View", label: "Left View" },
  { value: "Right View", label: "Right View" },
  { value: "Side View", label: "Side View" },
  { value: "Fabric Detail", label: "Fabric Detail" },
  { value: "Border Detail", label: "Border Detail" },
  { value: "Blouse Detail", label: "Blouse Detail" },
  { value: "Other", label: "Other / Custom" },
] as const;

export const STANDARD_VIEW_LABELS = [
  "Front View",
  "Back View",
  "Left View",
  "Right View",
  "Side View",
  "Fabric Detail",
  "Border Detail",
  "Blouse Detail",
];

function getSelectedViewOption(alt: string): string {
  if (!alt || !alt.trim()) return "";
  for (const label of STANDARD_VIEW_LABELS) {
    if (alt === label || alt.startsWith(`${label} -`)) return label;
  }
  return "Other";
}

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
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86),
  );
  if (!blob) throw new Error("Unable to optimize this image.");
  if (blob.size > 2600000) {
    blob =
      (await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.78),
      )) || blob;
  }
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
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      Object.values(localPreviews).forEach((url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [localPreviews]);

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
  async function performUpload(
    fileToUpload: File,
    recropIndex?: number,
    localPreviewUrl?: string,
  ) {
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

      if (localPreviewUrl) {
        setLocalPreviews((prev) => ({ ...prev, [r.path!]: localPreviewUrl }));
      }

      if (typeof recropIndex === "number" && recropIndex >= 0) {
        // Replace existing image path, preserving metadata
        const next = images.map((img, idx) =>
          idx === recropIndex ? { ...img, storage_path: r.path! } : img,
        );
        onChange(next);
        toast.success("Image replaced and updated successfully.");
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

    // Clean up current target imageSrc if created locally
    if (cropTarget?.imageSrc && cropTarget.imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(cropTarget.imageSrc);
    }

    // Upload cropped file with instant local preview
    await performUpload(
      croppedFile,
      isRecrop ? recropIndex : undefined,
      croppedBlobUrl,
    );

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
    const isRecrop = cropTarget.isRecrop;
    const recropIndex = cropTarget.recropIndex;
    if (cropTarget.imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(cropTarget.imageSrc);
    }
    try {
      const preparedFile = await prepare(rawFile);
      const localBlobUrl = URL.createObjectURL(preparedFile);
      await performUpload(
        preparedFile,
        isRecrop ? recropIndex : undefined,
        localBlobUrl,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    }
    if (!isRecrop) {
      proceedToNextInQueue();
    } else {
      setCropTarget(null);
    }
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

  /**
   * Replace an individual image with a new uploaded file
   */
  function handleReplaceSelect(index: number, files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)
    ) {
      toast.error("Please choose JPG, PNG, WebP, or AVIF images only.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File size must be under 25 MB.");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropTarget({
      imageSrc: objectUrl,
      fileName: file.name,
      isRecrop: true,
      recropIndex: index,
      rawFile: file,
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
          {multiple
            ? `Product photographs (${images.length}/20 uploaded)`
            : "Cover photograph"}{" "}
          · JPG, PNG, WebP or AVIF
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={multiple}
          disabled={busy || (multiple && images.length >= 20)}
          onChange={(e) => {
            handleFileSelect(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="loading-label" aria-live="polite">
        {busy
          ? progress
          : multiple
            ? "Upload up to 20 images. Assign viewing angles (Front, Back, Detail, etc.), choose the Primary Cover, reorder, or replace photos as needed."
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
              ? `Re-crop / Replace Image ${(cropTarget.recropIndex ?? 0) + 1}`
              : modalTitle ||
                `Crop & Frame Image ${pendingQueue.length > 0 ? `(1 of ${pendingQueue.length + 1})` : ""}`
          }
          onConfirm={handleCropConfirm}
          onSkip={handleCropSkip}
          onCancel={handleCropCancel}
        />
      )}

      {images.length > 0 && (
        <div className="upload-thumbnails-grid">
          {images.map((img, i) => {
            const currentView = getSelectedViewOption(img.alt_text);
            return (
              <div
                className={`upload-thumb-card ${img.is_cover ? "is-cover-thumb" : ""}`}
                key={`${img.storage_path}-${i}`}
              >
                <div className="upload-thumb-header">
                  <span className="upload-thumb-index">#{i + 1}</span>
                  {multiple && (
                    img.is_cover ? (
                      <span className="upload-cover-pill active" title="Active primary storefront cover">
                        <Star size={11} fill="#d4af37" /> PRIMARY
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="upload-set-cover-btn"
                        onClick={() => {
                          const next = images.map((v, j) => ({
                            ...v,
                            is_cover: j === i,
                          }));
                          onChange(next);
                          toast.success(`Image #${i + 1} set as Primary Cover.`);
                        }}
                        title="Set as storefront primary cover"
                      >
                        <Star size={11} /> Make Primary
                      </button>
                    )
                  )}
                </div>

                <div className="upload-thumb-image-container">
                  <OptimizedImage
                    src={localPreviews[img.storage_path] || img.storage_path}
                    fill
                    alt={img.alt_text || `Product view ${i + 1}`}
                    sizes="200px"
                  />
                  {currentView && currentView !== "Other" && (
                    <span className="upload-view-badge">{currentView}</span>
                  )}
                </div>

                <div className="upload-thumb-toolbar">
                  <label
                    className="upload-tool-btn"
                    title="Replace with a new image"
                  >
                    <RefreshCw size={12} />
                    <span>Replace</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={busy}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        handleReplaceSelect(i, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="upload-tool-btn"
                    title="Re-crop and adjust framing"
                    onClick={() => handleRecropExisting(i)}
                  >
                    <Crop size={12} />
                    <span>Crop</span>
                  </button>

                  {multiple && (
                    <>
                      <button
                        type="button"
                        className="upload-tool-btn"
                        disabled={i === 0}
                        title="Move image left"
                        onClick={() => move(i, -1)}
                      >
                        <ArrowLeft size={12} />
                      </button>
                      <button
                        type="button"
                        className="upload-tool-btn"
                        disabled={i === images.length - 1}
                        title="Move image right"
                        onClick={() => move(i, 1)}
                      >
                        <ArrowRight size={12} />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="upload-tool-btn danger"
                    title="Remove photograph"
                    onClick={() => {
                      if (localPreviews[img.storage_path]) {
                        URL.revokeObjectURL(localPreviews[img.storage_path]);
                        setLocalPreviews((prev) => {
                          const copy = { ...prev };
                          delete copy[img.storage_path];
                          return copy;
                        });
                      }
                      const next = images.filter((_, j) => i !== j);
                      onChange(
                        next.map((v, j) => ({
                          ...v,
                          sort_order: j,
                          is_cover: img.is_cover ? j === 0 : v.is_cover,
                        })),
                      );
                      toast.info(`Image #${i + 1} removed.`);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="upload-thumb-meta">
                  <label className="upload-meta-field">
                    <span>View angle:</span>
                    <select
                      value={currentView}
                      onChange={(e) => {
                        const val = e.target.value;
                        let newAlt = val;
                        if (val === "Other") {
                          newAlt =
                            img.alt_text && !STANDARD_VIEW_LABELS.includes(img.alt_text)
                              ? img.alt_text
                              : "Detail View";
                        }
                        const next = images.map((v, j) =>
                          j === i ? { ...v, alt_text: newAlt } : v,
                        );
                        onChange(next);
                      }}
                    >
                      {VIEW_LABEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="upload-meta-field">
                    <span>Alt description:</span>
                    <input
                      value={img.alt_text}
                      placeholder="e.g. Front View, Saree border detail"
                      onChange={(e) => {
                        const text = e.target.value;
                        const next = images.map((v, j) =>
                          j === i ? { ...v, alt_text: text } : v,
                        );
                        onChange(next);
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
