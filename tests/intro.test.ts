import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import metadata from "../public/intro/frames.json";
import {
  drawBounds,
  frameUrl,
  frameSource,
  introMode,
  introProgress,
  introVerticalFocus,
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
  assert.equal(scrollFrame(0, metadata), 0);
  assert.equal(scrollFrame(0.04, metadata), 0);
  assert.equal(scrollFrame(0.88, metadata), 159);
  assert.equal(scrollFrame(0.94, metadata), 159);
  assert.equal(scrollFrame(1, metadata), 159);
  assert.ok(scrollFrame(0.5, metadata) > scrollFrame(0.4, metadata));
  assert.equal(scrollFrame(-1, metadata), 0);
  assert.equal(scrollFrame(5, metadata), 159);
  assert.match(
    frameUrl(metadata, "mobile", 159),
    /\/mobile\/frame-0160.webp\?v=/,
  );
});

test("mobile source rectangles exclude only the known export padding", () => {
  assert.equal(metadata.mobile.contentBounds.length, metadata.frameCount);
  assert.deepEqual(frameSource(metadata.mobile, 0), {
    x: 0,
    y: 437,
    width: 720,
    height: 405,
  });
  assert.deepEqual(frameSource(metadata.mobile, 159), {
    x: 0,
    y: 251,
    width: 720,
    height: 778,
  });
  for (let index = 0; index < metadata.frameCount; index++) {
    const source = frameSource(metadata.mobile, index);
    assert.equal(source.x, 0);
    assert.equal(source.width, 720);
    assert.equal(source.y, Math.floor((1280 - source.height) / 2));
    assert.ok(source.y >= 0 && source.y + source.height <= 1280);
    assert.ok(source.height >= 405 && source.height <= 778);
    if (index <= 124) assert.equal(source.height, 405);
    if (index > 0)
      assert.ok(
        source.height >= frameSource(metadata.mobile, index - 1).height,
      );
  }
  assert.deepEqual(frameSource(metadata.desktop, 80), {
    x: 0,
    y: 0,
    width: 1440,
    height: 810,
  });
});

test("every frame fills viewport width without horizontal inset or distortion", () => {
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [430, 932],
    [768, 1024],
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
      const bounds = drawBounds(width, height, source);
      assert.ok(
        Math.abs(bounds.width / bounds.height - source.width / source.height) <
          0.00001,
      );
      assert.equal(bounds.x, 0);
      assert.equal(bounds.width, width);
      assert.ok(
        Math.abs(bounds.width / source.width - bounds.height / source.height) <
          0.00001,
      );
      if (bounds.height <= height)
        assert.equal(bounds.y, (height - bounds.height) / 2);
      else {
        assert.ok(bounds.y <= 0 && bounds.y + bounds.height >= height);
        const focusHeight =
          (introVerticalFocus.bottom - introVerticalFocus.top) * bounds.height;
        if (focusHeight <= height) {
          assert.ok(
            bounds.y + introVerticalFocus.top * bounds.height >= -0.00001,
          );
          assert.ok(
            bounds.y + introVerticalFocus.bottom * bounds.height <=
              height + 0.00001,
          );
        } else assert.equal(bounds.y, (height - bounds.height) / 2);
      }
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
  assert.equal(metadata.source.frameCount, 240);
  assert.equal(metadata.source.fps, "24/1");
  const welcome = await readFile("public/intro/scroll-to-continue.png");
  assert.equal(
    createHash("sha256").update(welcome).digest("hex"),
    "2b1c83ad2922c6f8c2fce6fee3539700bcb0365c6ada6d3a7538862fbccf443f",
  );
});
