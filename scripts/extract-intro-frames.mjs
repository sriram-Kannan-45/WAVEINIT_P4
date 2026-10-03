import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import path from "node:path";
import sharp from "sharp";
import { posterEdgeStyles } from "./intro-poster-edges.mjs";

sharp.cache(false);

if (!process.argv[2])
  throw new Error(
    "Usage: npm run intro:extract -- <source.mp4> [--start-frame N] [--lossless-frames N]",
  );
const source = path.resolve(process.argv[2]);
const startOption = process.argv.indexOf("--start-frame");
const startFrame = startOption < 0 ? 0 : Number(process.argv[startOption + 1]);
const losslessOption = process.argv.indexOf("--lossless-frames");
const losslessFrames =
  losslessOption < 0 ? Infinity : Number(process.argv[losslessOption + 1]);
if (
  losslessFrames !== Infinity &&
  (!Number.isInteger(losslessFrames) || losslessFrames < 0)
)
  throw new Error("The lossless frame count must be a non-negative integer.");
if (!Number.isInteger(startFrame) || startFrame < 0)
  throw new Error("The start frame must be a non-negative integer.");
const output = path.resolve("public/intro");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const background = "#fffcef";
const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result;
};

function probeSource() {
  try {
    const probe = JSON.parse(
      run(process.env.FFPROBE_PATH || "ffprobe", [
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,avg_frame_rate,r_frame_rate,nb_read_frames,duration,sample_aspect_ratio:format=duration",
        "-of",
        "json",
        source,
      ]).stdout,
    );
    const video = probe.streams[0];
    if (video.sample_aspect_ratio !== "1:1")
      throw new Error("Inspect non-square source pixels before extracting.");
    if (video.avg_frame_rate !== video.r_frame_rate)
      throw new Error(
        "Variable-rate footage needs a timestamp-aware sequence.",
      );
    return {
      width: video.width,
      height: video.height,
      duration: Number(video.duration || probe.format.duration),
      fps: video.avg_frame_rate,
      frameCount: Number(video.nb_read_frames),
    };
  } catch (error) {
    if (!["ENOENT", "EPERM"].includes(error.code)) throw error;
    // FFmpeg can also verify a constant integer-rate stream by fully decoding
    // it. Do not substitute the previous clip's duration, rate or frame count.
    const decoded = run(ffmpeg, [
      "-hide_banner",
      "-nostats",
      "-i",
      source,
      "-map",
      "0:v:0",
      "-an",
      "-progress",
      "pipe:1",
      "-f",
      "null",
      "-",
    ]);
    const stream = decoded.stderr.match(
      /Video:.*?, (\d+)x(\d+)[\s,].*?, ([\d.]+) fps/,
    );
    const frames = [...decoded.stdout.matchAll(/^frame=(\d+)$/gm)].at(-1);
    const time = [...decoded.stdout.matchAll(/^out_time_us=(\d+)$/gm)].at(-1);
    const fps = Number(stream?.[3]);
    const frameCount = Number(frames?.[1]);
    if (
      !stream ||
      Number(stream[1]) <= 0 ||
      Number(stream[2]) <= 0 ||
      !time ||
      !Number.isInteger(fps) ||
      !frameCount ||
      Math.abs(frameCount / fps - Number(time?.[1]) / 1_000_000) > 0.001
    )
      throw new Error("FFprobe is required to inspect this source's timing.");
    return {
      width: Number(stream[1]),
      height: Number(stream[2]),
      duration: frameCount / fps,
      fps: `${fps}/1`,
      frameCount,
    };
  }
}

const video = probeSource();
const [numerator, denominator] = video.fps.split("/").map(Number);
const fps = numerator / denominator;
if (!Number.isFinite(fps) || fps <= 0 || startFrame >= video.frameCount)
  throw new Error("Invalid source rate or start frame.");
const sourceHash = createHash("sha256")
  .update(await readFile(source))
  .digest("hex");
// Keep staging on the output's drive so publishing can use atomic renames.
const stagingRoot = path.resolve("output");
await mkdir(stagingRoot, { recursive: true });
const temporary = await mkdtemp(path.join(stagingRoot, "achu-intro-"));
try {
  for (const mode of ["desktop", "mobile"])
    await mkdir(path.join(output, mode), { recursive: true });

  // Keep every retained native frame, including the first tiny entrance and
  // actual final logo. Only the inspected leading welcome footage is omitted.
  run(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    source,
    "-an",
    "-vf",
    `trim=start_frame=${startFrame}:end_frame=${video.frameCount}`,
    "-fps_mode",
    "passthrough",
    "-c:v",
    "png",
    "-pix_fmt",
    "rgb24",
    "-compression_level",
    "1",
    path.join(temporary, "frame-%04d.png"),
  ]);
  const names = (await readdir(temporary))
    .filter((name) => name.endsWith(".png"))
    .sort()
    .map((name) => name.replace(".png", ".webp"));
  const frameCount = names.length;
  if (frameCount !== video.frameCount - startFrame)
    throw new Error("Extraction dropped or duplicated source frames.");

  const sets = {};
  for (const [mode, width] of [
    ["desktop", 1440],
    ["mobile", 720],
  ]) {
    const staging = path.join(temporary, mode);
    await mkdir(staging);
    let bytes = 0;
    const height = Math.round((width * video.height) / video.width);
    for (let i = 0; i < frameCount; i++) {
      // Uniform whole-frame resolution reduction only. No subject scaling,
      // crop, padding, fade, pan, late zoom, or temporal resampling.
      const frame = await sharp(
        path.join(temporary, names[i].replace(".webp", ".png")),
      )
        .resize({ width })
        .webp({ lossless: i < losslessFrames, quality: 90, effort: 4 })
        .toBuffer();
      await writeFile(path.join(staging, names[i]), frame);
      bytes += frame.length;
      if ((i + 1) % 40 === 0) console.log(`${mode}: ${i + 1}/${frameCount}`);
    }
    // Remove only obsolete, explicitly named generated sequence files.
    for (const name of await readdir(path.join(output, mode)))
      if (/^frame-\d{4}\.webp$/.test(name) && !names.includes(name))
        await rm(path.join(output, mode, name));
    sets[mode] = {
      width,
      height,
      path: `/intro/${mode}/frame-%04d.webp`,
      bytes,
      framing:
        "Complete source frame at a fixed 16:9 ratio; no crop, padding or animated reframe.",
    };
  }
  // Publish complete files only after encoding both sets. Retry transient
  // Windows sharing locks from the running preview, never expose a partial WebP.
  for (const mode of ["desktop", "mobile"])
    for (const name of names) {
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(
            path.join(temporary, mode, name),
            path.join(output, mode, name),
          );
          break;
        } catch (error) {
          if (
            attempt >= 7 ||
            !["UNKNOWN", "EBUSY", "EPERM", "EACCES"].includes(error.code)
          )
            throw error;
          await setTimeout(250 * (attempt + 1));
        }
      }
    }
  await writeFile(
    path.join(output, "poster-edges.json"),
    JSON.stringify(
      {
        first: await posterEdgeStyles(
          await readFile(path.join(output, "desktop", names[0])),
        ),
        last: await posterEdgeStyles(
          await readFile(path.join(output, "desktop", names.at(-1))),
        ),
      },
      null,
      2,
    ) + "\n",
  );

  const metadata = {
    revision: createHash("sha256")
      .update(
        `${sourceHash}:${startFrame}:${video.frameCount}:${video.fps}:1440:720:rgb-contain-v6:${Math.min(frameCount, losslessFrames)}:90`,
      )
      .digest("hex")
      .slice(0, 12),
    source: { filename: path.basename(source), sha256: sourceHash, ...video },
    animation: {
      startFrame,
      endFrame: video.frameCount - 1,
      startTime: startFrame / fps,
      duration: frameCount / fps,
      framing:
        "Leading welcome omitted; every entrance-through-logo frame retained in source order at native cadence.",
    },
    frameCount,
    encoding: {
      losslessFrames: Math.min(frameCount, losslessFrames),
      continuationQuality: 90,
    },
    fps,
    background,
    scroll: {
      desktopScreens: 4,
      mobileScreens: 4.5,
      startHold: 0.04,
      animationEnd: 0.88,
      fadeStart: 0.96,
    },
    ...sets,
  };
  await writeFile(
    path.join(output, "frames.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(JSON.stringify(metadata, null, 2));
} finally {
  if (
    path.dirname(temporary) !== stagingRoot ||
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
