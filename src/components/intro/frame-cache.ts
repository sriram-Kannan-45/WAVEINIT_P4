import { frameUrl, type IntroMetadata, type IntroMode } from "./canvas-utils";

type Decoded = ImageBitmap | HTMLImageElement;

/** Retain compressed blobs, and maintain a generous sliding window of decoded frames for smooth continuous playback. */
export class IntroFrameCache {
  readonly mode: IntroMode;
  private blobs = new Map<number, Blob>();
  private images = new Map<number, Decoded>();
  private fetching = new Set<number>();
  private decoding = new Set<number>();
  private failed = new Set<number>();
  private controllers = new Set<AbortController>();
  private objectUrls = new Set<string>();
  private objectUrlByImage = new Map<number, string>();
  private target = 0;
  private direction = 1;
  private stopped = false;
  private reduced = false;

  constructor(
    private metadata: IntroMetadata,
    mode: IntroMode,
    private ready: () => void,
    reduced = false,
  ) {
    this.mode = mode;
    this.reduced = reduced;
    if (reduced) {
      this.target = metadata.frameCount - 1;
    }
    // Start background preloading immediately upon initialization
    this.pump();
  }

  setTarget(index: number, reduced = false) {
    this.reduced = reduced;
    const next = reduced
      ? this.metadata.frameCount - 1
      : Math.max(
          0,
          Math.min(this.metadata.frameCount - 1, Math.round(index)),
        );
    if (next !== this.target) this.direction = next >= this.target ? 1 : -1;
    this.target = next;
    this.trim();
    this.pump();
  }

  nearest(index: number) {
    // Exact match fast path
    const direct = this.images.get(index);
    if (direct) return { image: direct, index };

    // Check immediate neighbor frames within ±8 frames first
    for (let offset = 1; offset <= 8; offset++) {
      const forward = this.images.get(index + offset);
      if (forward) return { image: forward, index: index + offset };
      const backward = this.images.get(index - offset);
      if (backward) return { image: backward, index: index - offset };
    }

    // Fall back to closest available decoded frame
    let distance = Infinity;
    let found: { image: Decoded; index: number } | undefined;
    for (const [key, image] of this.images) {
      const delta = Math.abs(key - index);
      if (delta < distance) {
        distance = delta;
        found = { image, index: key };
      }
    }
    return found;
  }

  private priority() {
    if (this.reduced) {
      return [this.metadata.frameCount - 1];
    }
    const order: number[] = [this.target];
    // Decode a wide window ahead in the direction of scrolling
    const ahead = this.mode === "mobile" ? 40 : 45;
    const behind = this.mode === "mobile" ? 20 : 25;
    for (let d = 1; d <= ahead; d++) {
      order.push(this.target + d * this.direction);
    }
    for (let d = 1; d <= behind; d++) {
      order.push(this.target - d * this.direction);
    }
    // Critical anchors: frame 0 (entrance) and final frame (completed logo)
    order.push(0, this.metadata.frameCount - 1);
    // All remaining frames in sequence so the entire animation preloads
    for (let i = 0; i < this.metadata.frameCount; i++) {
      order.push(i);
    }
    return [...new Set(order)].filter(
      (i) => i >= 0 && i < this.metadata.frameCount,
    );
  }

  private trim() {
    // Keep a generous window of decoded frames:
    // Mobile: 80 frames (~90MB RGBA texture memory, fully safe on modern mobile devices).
    // Desktop: 120 frames.
    const capacity = this.mode === "mobile" ? 80 : 120;
    if (this.images.size <= capacity) return;

    // Evict the frames that are furthest from current target
    const sorted = [...this.images.keys()].sort(
      (a, b) => Math.abs(b - this.target) - Math.abs(a - this.target),
    );
    const toRemove = sorted.slice(0, this.images.size - capacity);
    for (const index of toRemove) {
      const image = this.images.get(index);
      if (image) {
        if ("close" in image) image.close();
        else image.src = "";
        this.images.delete(index);
      }
      const url = this.objectUrlByImage.get(index);
      if (url) {
        URL.revokeObjectURL(url);
        this.objectUrls.delete(url);
        this.objectUrlByImage.delete(index);
      }
    }
  }

  private pump() {
    if (this.stopped) return;
    const order = this.priority();
    const decodeCapacity = this.mode === "mobile" ? 80 : 120;
    const decodeLimit = 4;
    const fetchLimit = this.mode === "mobile" ? 6 : 8;

    // Decode priority frames within decodeCapacity
    for (const index of order.slice(0, this.reduced ? 1 : decodeCapacity)) {
      if (this.decoding.size >= decodeLimit) break;
      if (
        this.blobs.has(index) &&
        !this.images.has(index) &&
        !this.decoding.has(index) &&
        !this.failed.has(index)
      ) {
        void this.decode(index);
      }
    }

    // Fetch compressed blobs for frames
    for (const index of order) {
      if (this.fetching.size >= fetchLimit) break;
      if (
        !this.blobs.has(index) &&
        !this.fetching.has(index) &&
        !this.failed.has(index)
      ) {
        void this.load(index);
      }
    }
  }

  private async load(index: number) {
    const controller = new AbortController();
    this.controllers.add(controller);
    this.fetching.add(index);
    try {
      const response = await fetch(frameUrl(this.metadata, this.mode, index), {
        signal: controller.signal,
        cache: "force-cache",
      });
      if (!response.ok) throw new Error("Intro frame unavailable");
      const blob = await response.blob();
      if (!this.stopped) {
        this.blobs.set(index, blob);
      }
    } catch {
      if (!this.stopped) this.failed.add(index);
    } finally {
      this.controllers.delete(controller);
      this.fetching.delete(index);
      this.pump();
    }
  }

  private async decode(index: number) {
    this.decoding.add(index);
    let image: Decoded | undefined;
    let createdUrl: string | undefined;
    try {
      const blob = this.blobs.get(index);
      if (!blob) return;

      if (typeof createImageBitmap === "function") {
        try {
          image = await createImageBitmap(blob);
        } catch {
          /* Fall back to Image.decode */
        }
      }
      if (!image) {
        createdUrl = URL.createObjectURL(blob);
        this.objectUrls.add(createdUrl);
        const element = new Image();
        element.decoding = "async";
        element.src = createdUrl;
        await element.decode();
        image = element;
      }
      if (this.stopped) {
        if ("close" in image) image.close();
        if (createdUrl) {
          URL.revokeObjectURL(createdUrl);
          this.objectUrls.delete(createdUrl);
        }
        return;
      }
      this.images.set(index, image);
      if (createdUrl) {
        this.objectUrlByImage.set(index, createdUrl);
      }
      this.trim();
      this.ready();
    } catch {
      if (!this.stopped) this.failed.add(index);
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
        this.objectUrls.delete(createdUrl);
      }
    } finally {
      this.decoding.delete(index);
      this.pump();
    }
  }

  dispose() {
    this.stopped = true;
    for (const controller of this.controllers) controller.abort();
    for (const image of this.images.values()) {
      if ("close" in image) image.close();
      else image.src = "";
    }
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.images.clear();
    this.blobs.clear();
    this.objectUrls.clear();
    this.objectUrlByImage.clear();
    this.controllers.clear();
    this.fetching.clear();
    this.decoding.clear();
  }
}
