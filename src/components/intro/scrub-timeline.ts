/** Follow only the latest scroll target. Never jump over an available source
 * frame, even after a large wheel gesture or a delayed animation callback. */
export function scrubFrame(
  current: number,
  target: number,
  elapsedMs: number,
  framesPerSecond = 48,
) {
  const difference = target - current;
  const elapsed = Math.min(50, Math.max(0, elapsedMs));
  const eased = Math.abs(difference) * (1 - Math.exp(-elapsed / 110));
  const step = Math.min(1, (framesPerSecond * elapsed) / 1000, eased);
  return Math.abs(difference) < 0.02
    ? target
    : current + Math.sign(difference) * step;
}
