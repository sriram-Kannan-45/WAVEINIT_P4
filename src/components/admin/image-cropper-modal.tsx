"use client";

import { useState, useCallback } from "react";
import Cropper, { type Point, type Area } from "react-easy-crop";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Maximize2,
  Crop as CropIcon,
  Sparkles,
} from "lucide-react";
import { getCroppedImg } from "@/lib/crop-image";

export type AspectRatioPreset = {
  label: string;
  value: number | undefined; // undefined for free crop
  iconName?: string;
  description?: string;
};

export const CROP_PRESETS: Record<string, AspectRatioPreset[]> = {
  products: [
    { label: "3:4 Portrait (Default)", value: 3 / 4, description: "Standard boutique product card" },
    { label: "4:5 Fashion", value: 4 / 5, description: "Taller garment showcase" },
    { label: "1:1 Square", value: 1 / 1, description: "Square product thumbnail" },
    { label: "Free Ratio", value: undefined, description: "Custom framing" },
  ],
  categories: [
    { label: "1:1 Square / Circle (Default)", value: 1 / 1, description: "Matches circular storefront showcase" },
    { label: "3:4 Portrait", value: 3 / 4, description: "Editorial category card" },
    { label: "4:3 Classic", value: 4 / 3, description: "Wide category display" },
    { label: "Free Ratio", value: undefined, description: "Custom framing" },
  ],
  collections: [
    { label: "4:3 / 4:4.5 Collection (Default)", value: 4 / 4.5, description: "Storefront collection cards" },
    { label: "16:9 Wide", value: 16 / 9, description: "Landscape collection banner" },
    { label: "1:1 Square", value: 1 / 1, description: "Square collection tile" },
    { label: "Free Ratio", value: undefined, description: "Custom framing" },
  ],
  banners: [
    { label: "16:9 Landscape (Default)", value: 16 / 9, description: "Standard promo banner" },
    { label: "21:9 Cinematic", value: 21 / 9, description: "Full-width hero showcase" },
    { label: "3:1 Ultra-wide", value: 3 / 1, description: "Narrow header strip" },
    { label: "Free Ratio", value: undefined, description: "Custom framing" },
  ],
};

interface ImageCropperModalProps {
  imageSrc: string;
  fileName?: string;
  folder?: "products" | "categories" | "collections" | "banners";
  cropShape?: "rect" | "round";
  defaultAspect?: number;
  title?: string;
  onConfirm: (croppedFile: File, croppedBlobUrl: string) => void;
  onSkip?: () => void;
  onCancel: () => void;
}

export function ImageCropperModal({
  imageSrc,
  fileName = "image.webp",
  folder = "products",
  cropShape = "rect",
  defaultAspect,
  title = "Crop & Frame Photograph",
  onConfirm,
  onSkip,
  onCancel,
}: ImageCropperModalProps) {
  const presets = CROP_PRESETS[folder] || CROP_PRESETS.products;
  const initialAspect = defaultAspect ?? presets[0]?.value ?? 3 / 4;

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(initialAspect);
  const [shape, setShape] = useState<"rect" | "round">(
    cropShape === "round" || folder === "categories" ? "round" : "rect",
  );
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(initialAspect);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const { file, blobUrl } = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        fileName,
      );
      onConfirm(file, blobUrl);
    } catch (err) {
      console.error("Failed to crop image:", err);
      // Fallback: if crop fails, skip
      onSkip?.();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cropper-modal-container">
        {/* Header */}
        <div className="cropper-header">
          <div className="cropper-title-group">
            <span className="cropper-eyebrow">
              <Sparkles size={13} />
              ACHU OWNER’S SUITE · IMAGE FRAMING
            </span>
            <h2>{title}</h2>
            <p className="cropper-subtitle">
              Drag and zoom to keep important garment details centered. The customer storefront will display this exact crop.
            </p>
          </div>
          <button
            type="button"
            className="cropper-close-btn"
            onClick={onCancel}
            aria-label="Cancel crop"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper Viewport */}
        <div className="cropper-workspace">
          <div className="cropper-stage">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={shape}
              showGrid={true}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Aspect Ratio Toolbar */}
          <div className="cropper-controls-panel">
            <div className="cropper-section">
              <label className="cropper-section-title">
                <CropIcon size={14} />
                <span>Framing Preset</span>
              </label>
              <div className="cropper-presets-row">
                {presets.map((preset) => {
                  const isSelected = aspect === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={`cropper-preset-btn ${isSelected ? "active" : ""}`}
                      onClick={() => setAspect(preset.value)}
                    >
                      <span className="preset-name">{preset.label}</span>
                      {preset.description && (
                        <span className="preset-desc">{preset.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mask Toggle (Rectangle vs Circular) */}
            {folder === "categories" && (
              <div className="cropper-section">
                <label className="cropper-section-title">
                  <Maximize2 size={14} />
                  <span>Overlay Guide</span>
                </label>
                <div className="cropper-shape-row">
                  <button
                    type="button"
                    className={`cropper-shape-btn ${shape === "round" ? "active" : ""}`}
                    onClick={() => {
                      setShape("round");
                      setAspect(1 / 1);
                    }}
                  >
                    Circular Guide (Storefront)
                  </button>
                  <button
                    type="button"
                    className={`cropper-shape-btn ${shape === "rect" ? "active" : ""}`}
                    onClick={() => setShape("rect")}
                  >
                    Rectangular Guide
                  </button>
                </div>
              </div>
            )}

            {/* Zoom Slider */}
            <div className="cropper-section">
              <div className="cropper-zoom-header">
                <span className="cropper-section-title">
                  <ZoomIn size={14} />
                  <span>Zoom Level</span>
                </span>
                <span className="cropper-zoom-val">{Math.round(zoom * 100)}%</span>
              </div>
              <div className="cropper-zoom-controls">
                <button
                  type="button"
                  className="cropper-zoom-btn"
                  onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
                  aria-label="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="cropper-zoom-slider"
                  aria-label="Adjust zoom"
                />
                <button
                  type="button"
                  className="cropper-zoom-btn"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                  aria-label="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  className="cropper-reset-btn"
                  onClick={handleReset}
                  title="Reset framing"
                  aria-label="Reset crop"
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="cropper-footer">
          <div className="cropper-footer-left">
            {onSkip && (
              <button
                type="button"
                className="button secondary cropper-skip-btn"
                onClick={onSkip}
                disabled={isProcessing}
              >
                Use original uncropped
              </button>
            )}
            <button
              type="button"
              className="button subtle cropper-cancel-btn"
              onClick={onCancel}
              disabled={isProcessing}
            >
              <X size={15} />
              <span>Cancel</span>
            </button>
          </div>
          <button
            type="button"
            className="button primary cropper-confirm-btn"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            <Check size={16} />
            <span>{isProcessing ? "Applying Crop…" : "Confirm & Save Crop"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
