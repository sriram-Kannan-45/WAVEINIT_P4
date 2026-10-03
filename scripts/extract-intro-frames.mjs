import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { portraitFrame } from "./intro-reframe.mjs";
import { posterEdgeStyles } from "./intro-poster-edges.mjs";

// Release libvips file handles promptly, including on Windows.
sharp.cache(false);

const source = path.resolve(process.argv[2] || "");
if (!process.argv[2])
  throw new Error("Usage: npm run intro:extract -- <source.mp4>");
const output = path.resolve("public/intro");
const fps = 16;
const background = "#fffcef";
const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
};
const probe = JSON.parse(
  run(process.env.FFPROBE_PATH || "ffprobe", [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,avg_frame_rate,nb_read_frames,duration:format=duration",
    "-of",
    "json",
    source,
  ]),
);
const video = probe.streams[0];
if (
  video.width !== 1920 ||
  video.height !== 1080 ||
  Number(probe.format.duration) !== 10
)
  throw new Error(
    "This framing was verified for the approved 1920×1080, 10-second clip. Inspect a replacement before extracting.",
  );
const sourceHash = createHash("sha256")
  .update(await readFile(source))
  .digest("hex");
const temporary = await mkdtemp(path.join(tmpdir(), "achu-intro-"));
try {
  await mkdir(path.join(output, "desktop"), { recursive: true });
  await mkdir(path.join(output, "mobile"), { recursive: true });
  // Lossless intermediate frames; never modify or re-encode the source MP4.
  run(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    source,
    "-an",
    "-vf",
    `fps=${fps}`,
    "-c:v",
    "libwebp",
    "-lossless",
    "1",
    "-compression_level",
    "4",
    path.join(temporary, "frame-%04d.webp"),
  ]);
  const names = (await readdir(temporary))
    .filter((name) => name.endsWith(".webp"))
    .sort();
  const frameCount = names.length;
  const mobileContentBounds = [];
  let desktopBytes = 0,
    mobileBytes = 0;
  for (let i = 0; i < frameCount; i++) {
    const input = path.join(temporary, names[i]);
    const quality = i >= frameCount * 0.8 ? 90 : 82;
    const desktop = await sharp(input)
      .resize(1440, 810)
      .webp({ quality, effort: 5 })
      .toBuffer();
    // Full flight is retained. Only after the flying bird has settled into the
    // central emblem does a smooth 1.75-second reframe enlarge the finished logo.
    // At 7.8s the artwork spans ~1240px; at 9s it fits inside the 1000px safe area.
    const t = Math.max(0, Math.min(1, (i / fps - 7.75) / 1.75));
    const eased = t * t * (3 - 2 * t);
    const cropWidth = Math.round(1920 - 920 * eased);
    const mobileArt = await sharp(input)
      .extract({
        left: Math.floor((1920 - cropWidth) / 2),
        top: 0,
        width: cropWidth,
        height: 1080,
      })
      .resize({ width: 720 })
      .toBuffer();
    const mobile = await portraitFrame(mobileArt, quality);
    const artSize = await sharp(mobileArt).metadata();
    mobileContentBounds.push([
      0,
      Math.floor((1280 - artSize.height) / 2),
      artSize.width,
      artSize.height,
    ]);
    await writeFile(path.join(output, "desktop", names[i]), desktop);
    await writeFile(path.join(output, "mobile", names[i]), mobile);
    desktopBytes += desktop.length;
    mobileBytes += mobile.length;
    if ((i + 1) % 40 === 0)
      console.log(`Encoded ${i + 1}/${frameCount} frames`);
  }
  // The final source frame, rather than a synthetic or regenerated logo.
  run(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    source,
    "-an",
    "-vf",
    "select=eq(n\\,239)",
    "-frames:v",
    "1",
    "-c:v",
    "libwebp",
    "-lossless",
    "1",
    path.join(temporary, "last.webp"),
  ]);
  const lastName = names.at(-1);
  const finalDesktop = await sharp(path.join(temporary, "last.webp"))
    .resize(1440, 810)
    .webp({ quality: 90, effort: 5 })
    .toBuffer();
  const finalArt = await sharp(path.join(temporary, "last.webp"))
    .extract({ left: 460, top: 0, width: 1000, height: 1080 })
    .resize({ width: 720 })
    .toBuffer();
  const finalMobile = await portraitFrame(finalArt, 90);
  const finalSize = await sharp(finalArt).metadata();
  mobileContentBounds[frameCount - 1] = [
    0,
    Math.floor((1280 - finalSize.height) / 2),
    finalSize.width,
    finalSize.height,
  ];
  desktopBytes +=
    finalDesktop.length -
    (await readFile(path.join(output, "desktop", lastName))).length;
  mobileBytes +=
    finalMobile.length -
    (await readFile(path.join(output, "mobile", lastName))).length;
  await writeFile(path.join(output, "desktop", lastName), finalDesktop);
  await writeFile(path.join(output, "mobile", lastName), finalMobile);
  await writeFile(
    path.join(output, "poster-edges.json"),
    JSON.stringify(
      {
        first: await posterEdgeStyles(
          await readFile(path.join(output, "desktop", names[0])),
        ),
        last: await posterEdgeStyles(finalDesktop),
      },
      null,
      2,
    ) + "\n",
  );
  const metadata = {
    revision: createHash("sha256")
      .update(`${sourceHash}:16:1440:720:reframe-v2`)
      .digest("hex")
      .slice(0, 12),
    source: {
      filename: path.basename(source),
      sha256: sourceHash,
      width: video.width,
      height: video.height,
      duration: Number(probe.format.duration),
      fps: video.avg_frame_rate,
      frameCount: Number(video.nb_read_frames),
    },
    frameCount,
    fps,
    background,
    scroll: {
      desktopScreens: 4,
      mobileScreens: 4.5,
      startHold: 0.04,
      animationEnd: 0.88,
      fadeStart: 0.96,
    },
    desktop: {
      width: 1440,
      height: 810,
      path: "/intro/desktop/frame-%04d.webp",
      bytes: desktopBytes,
    },
    mobile: {
      width: 720,
      height: 1280,
      path: "/intro/mobile/frame-%04d.webp",
      bytes: mobileBytes,
      contentBounds: mobileContentBounds,
      framing:
        "Complete 16:9 flight, smoothly reframed from 7.75–9.5s to a verified central 1000×1080 safe crop on an ivory portrait field.",
    },
  };
  await writeFile(
    path.join(output, "frames.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(JSON.stringify(metadata, null, 2));
} finally {
  // This directory is returned by mkdtemp, never derived from the source path.
  if (
    path.dirname(temporary) !== path.resolve(tmpdir()) ||
    !path.basename(temporary).startsWith("achu-intro-")
  )
    throw new Error("Unexpected temporary directory; refusing cleanup.");
  await rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
}
