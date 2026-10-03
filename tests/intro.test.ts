import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import metadata from "../public/intro/frames.json";
import {
  drawBounds,
  cropPosition,
  frameUrl,
  frameSource,
  introMode,
  introProgress,
  portraitFit,
  scrollFrame,
} from "../src/components/intro/canvas-utils";

test("welcome reveal holds the first frame and preserves the original video timeline", () => {
  for (const height of [568, 700, 812, 844, 932, 1080]) {
    const front = 0.45 * height;
    for (const screens of [3, 3.5]) {
      const video = screens * height;
      for (const travel of [0, front / 2, front]) {
        const progress = introProgress(travel, front, video);
        assert.equal(progress.video, 0);
        assert.equal(scrollFrame(progress.video, metadata), 0);
      }
      for (const progress of [0.04, 0.5, 0.88, 0.96, 1]) {
        const phases = introProgress(front + progress * video, front, video);
        assert.equal(phases.front, 1);
        assert.ok(Math.abs(phases.video - progress) < 1e-10);
        assert.ok(
          Math.abs(
            scrollFrame(phases.video, metadata) -
              scrollFrame(progress, metadata),
          ) < 1e-10,
        );
      }
      assert.deepEqual(introProgress(-height, front, video), {
        front: 0,
        video: 0,
      });
      assert.deepEqual(introProgress(front + 2 * video, front, video), {
        front: 1,
        video: 1,
      });
      // Reversing to the reveal range restores the first frame immediately.
      assert.deepEqual(introProgress(front / 2, front, video), {
        front: 0.5,
        video: 0,
      });
    }
  }
});

test("scrubbing reserves a first-frame hold and a reversible final-logo hold", () => {
  const last = metadata.frameCount - 1;
  assert.equal(scrollFrame(0, metadata), 0);
  assert.equal(scrollFrame(0.04, metadata), 0);
  assert.equal(scrollFrame(0.88, metadata), last);
  assert.equal(scrollFrame(0.94, metadata), last);
  assert.equal(scrollFrame(1, metadata), last);
  assert.ok(scrollFrame(0.5, metadata) > scrollFrame(0.4, metadata));
  assert.equal(scrollFrame(-1, metadata), 0);
  assert.equal(scrollFrame(5, metadata), last);
  assert.match(
    frameUrl(metadata, "mobile", last),
    /\/mobile\/frame-0240.webp\?v=/,
  );
});

test("mobile retains the complete source with no export padding or late zoom", () => {
  assert.ok(!("contentBounds" in metadata.mobile));
  for (let index = 0; index < metadata.frameCount; index++) {
    assert.deepEqual(frameSource(metadata.mobile, index), {
      x: 0,
      y: 0,
      width: 720,
      height: 405,
    });
  }
  assert.deepEqual(frameSource(metadata.desktop, 80), {
    x: 0,
    y: 0,
    width: 1440,
    height: 810,
  });
});

test("every frame uses the approved portrait fit or viewport cover without distortion", () => {
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
    [768, 1024],
    [768, 1280],
    [1366, 768],
    [1532, 730],
    [1920, 800],
    [1920, 1080],
    [844, 390],
    [800, 800],
  ]) {
    const mode = introMode(width, height);
    for (let index = 0; index < metadata.frameCount; index++) {
      const source = frameSource(metadata[mode], index);
      const bounds = drawBounds(
        width,
        height,
        source,
        width <= height ? cropPosition(index, metadata.frameCount) : 0.5,
        index,
        metadata.frameCount,
      );
      assert.ok(
        Math.abs(bounds.width / bounds.height - source.width / source.height) <
          0.00001,
      );
      assert.ok(bounds.x <= 0);
      assert.ok(bounds.x + bounds.width >= width - 0.00001);
      if (portraitFit(width, height)) {
        assert.ok(bounds.y >= -0.00001);
        assert.ok(bounds.y + bounds.height <= height + 0.00001);
        if (index <= 20) {
          assert.equal(bounds.y, 0);
          assert.ok(Math.abs(bounds.height - height) < 0.00001);
        }
        if (index === metadata.frameCount - 1) {
          const curScale = bounds.width / source.width;
          const wreathLeft = bounds.x + 215 * curScale;
          const wreathRight = bounds.x + 498 * curScale;
          const textLeft = bounds.x + 246 * curScale;
          const textRight = bounds.x + 474 * curScale;
          const textBottom = bounds.y + 375 * curScale;
          assert.ok(wreathLeft >= 0);
          assert.ok(wreathRight <= width);
          assert.ok(textLeft >= 0);
          assert.ok(textRight <= width);
          assert.ok(textBottom <= height);
        }
      } else {
        assert.ok(bounds.x <= 0 && bounds.y <= 0);
        assert.ok(bounds.x + bounds.width >= width - 0.00001);
        assert.ok(bounds.y + bounds.height >= height - 0.00001);
      }
      assert.ok(
        Math.abs(bounds.width / source.width - bounds.height / source.height) <
          0.00001,
      );
      assert.ok(
        Math.abs(
          bounds.y -
            (height - bounds.height) *
              (portraitFit(width, height) ? 0.5 : 0.72),
        ) < 0.00001,
      );
      assert.ok(cropPosition(index, metadata.frameCount) >= 0);
      assert.ok(cropPosition(index, metadata.frameCount) <= 1);
    }
  }
});

test("both extracted sequences are complete, consistent WebP files with accurate payload metadata", async () => {
  for (const mode of ["mobile", "desktop"] as const) {
    const names = (await readdir(`public/intro/${mode}`))
      .filter((name) => name.endsWith(".webp"))
      .sort();
    assert.equal(names.length, metadata.frameCount);
    let bytes = 0;
    for (let index = 0; index < names.length; index++) {
      assert.equal(
        names[index],
        `frame-${String(index + 1).padStart(4, "0")}.webp`,
      );
      const buffer = await readFile(`public/intro/${mode}/${names[index]}`);
      bytes += buffer.length;
      const image = await sharp(buffer).metadata();
      assert.equal(image.format, "webp");
      assert.equal(image.width, metadata[mode].width);
      assert.equal(image.height, metadata[mode].height);
    }
    assert.equal(bytes, metadata[mode].bytes);
  }
  const source = await readFile(`video/${metadata.source.filename}`);
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    metadata.source.sha256,
  );
  assert.equal(metadata.source.filename, "achu_master_entrance_corrected.mp4");
  assert.equal(metadata.source.width, 1920);
  assert.equal(metadata.source.height, 1080);
  assert.equal(metadata.source.frameCount, 307);
  assert.equal(metadata.source.fps, "24/1");
  assert.equal(metadata.source.duration, 307 / 24);
  assert.equal(metadata.animation.startFrame, 67);
  assert.equal(metadata.animation.endFrame, 306);
  assert.equal(
    metadata.frameCount,
    metadata.source.frameCount - metadata.animation.startFrame,
  );
  assert.equal(metadata.fps, 24);
  assert.equal(metadata.encoding.losslessFrames, 45);
  assert.equal(metadata.animation.duration, metadata.frameCount / metadata.fps);
  const welcome = await readFile("public/intro/scroll-to-continue.png");
  assert.equal(
    createHash("sha256").update(welcome).digest("hex"),
    "2b1c83ad2922c6f8c2fce6fee3539700bcb0365c6ada6d3a7538862fbccf443f",
  );
});
