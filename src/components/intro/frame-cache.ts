import { frameUrl, type IntroMetadata, type IntroMode } from "./canvas-utils";

type Decoded = ImageBitmap | HTMLImageElement;

/** Retain compressed blobs, but only a bounded window of decoded frames. */
export class IntroFrameCache {
  readonly mode: IntroMode;
  private blobs = new Map<number, Blob>();
  private images = new Map<number, Decoded>();
  private fetching = new Set<number>();
  private decoding = new Set<number>();
  private failed = new Set<number>();
  private controllers = new Set<AbortController>();
  private objectUrls = new Set<string>();
  private target = 0;
  private direction = 1;
  private stopped = false;
  private reduced = false;

  constructor(
    private metadata: IntroMetadata,
    mode: IntroMode,
    private ready: () => void,
  ) {
    this.mode = mode;
  }

  setTarget(index: number, reduced = false) {
    const next = Math.max(
      0,
      Math.min(this.metadata.frameCount - 1, Math.round(index)),
    );
    if (next !== this.target) this.direction = next > this.target ? 1 : -1;
    this.target = next;
    this.reduced = reduced;
    this.trim();
    this.pump();
  }

  nearest(index: number) {
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
    const order = [this.target];
    if (!this.reduced) {
      const ahead = this.mode === "mobile" ? 10 : 24;
      const behind = this.mode === "mobile" ? 4 : 8;
      for (let d = 1; d <= ahead; d++)
        order.push(this.target + d * this.direction);
      for (let d = 1; d <= behind; d++)
        order.push(this.target - d * this.direction);
      order.push(0, this.metadata.frameCount - 1);
      for (let i = 0; i < this.metadata.frameCount; i++) order.push(i);
    }
    return [...new Set(order)].filter(
      (i) => i >= 0 && i < this.metadata.frameCount,
    );
  }

  private trim() {
    const capacity = this.mode === "mobile" ? 12 : 36;
    const keep = new Set(this.priority().slice(0, capacity));
    for (const [index, image] of this.images) {
      if (!keep.has(index)) {
        if ("close" in image) image.close();
        else image.src = "";
        this.images.delete(index);
      }
    }
  }

  private pump() {
    if (this.stopped) return;
    const order = this.priority();
    const decodeCapacity = this.mode === "mobile" ? 12 : 36;
    const decodeLimit = this.mode === "mobile" ? 2 : 4;
    const fetchLimit = this.mode === "mobile" ? 3 : 6;
    // Decode nearby frames only, and never decode the whole sequence at once.
    for (const index of order.slice(
      0,
      this.reduced ? 1 : decodeCapacity,
    )) {
      if (this.decoding.size >= decodeLimit) break;
      if (
        this.blobs.has(index) &&
        !this.images.has(index) &&
        !this.decoding.has(index) &&
        !this.failed.has(index)
      )
        void this.decode(index);
    }
    for (const index of order) {
      if (this.fetching.size >= fetchLimit) break;
      if (
        !this.blobs.has(index) &&
        !this.fetching.has(index) &&
        !this.failed.has(index)
      )
        void this.load(index);
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
      if (!this.stopped) this.blobs.set(index, blob);
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
    try {
      const blob = this.blobs.get(index)!;
      if (typeof createImageBitmap === "function") {
        try {
          image = await createImageBitmap(blob);
        } catch {
          /* Older Safari falls back to Image.decode. */
        }
      }
      if (!image) {
        const url = URL.createObjectURL(blob);
        this.objectUrls.add(url);
        try {
          const element = new Image();
          element.decoding = "async";
          element.src = url;
          await element.decode();
          image = element;
        } finally {
          URL.revokeObjectURL(url);
          this.objectUrls.delete(url);
        }
      }
      if (this.stopped) {
        if ("close" in image) image.close();
        return;
      }
      this.images.set(index, image);
      this.trim();
      this.ready();
    } catch {
      if (!this.stopped) this.failed.add(index);
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
  }
}
