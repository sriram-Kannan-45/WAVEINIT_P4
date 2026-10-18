# Scroll animation repair — 18 October 2026

## Cause and implementation

The canvas sequence already mapped scroll to progress, but its smoothing increased catch-up speed as far as 720 frames/second. Nearest-frame substitution could change pictures out of order as decodes arrived. The intro also started global category keyframes underneath the opaque intro, while the category observer removed its own reveal classes. Skip overshot the overlapping storefront by one viewport.

The existing canvas now follows one latest scroll target, traversing exact decoded frames with a maximum one-frame step per RAF and a 48-frame/second limit. Missing downloads hold the current picture until ready; failed assets can be bypassed. A restored position that points directly at a failed asset can display a decoded neighbor within two frames. Reversal immediately changes direction. The final fade is coordinated with frame completion and scroll progress. Decoded memory is bounded to 16 desktop or 12 mobile frames plus in-flight decodes. No new dependency, duplicate video, source-frame change, image-quality reduction, or React state loop was introduced.

Video travel is 500svh on desktop and 550svh on mobile, with the existing 45svh opening transition. Half the configured range maps to half of scroll progress. Gesture distance depends on the input device. Large scrubs settle over a bounded traversal instead of racing through the footage; restoration, explicit Skip and scrolling entirely beyond the intro may bypass that traversal. Native input is not intercepted.

Category cards use one viewport queue, a 160ms stagger, and 900ms opacity/transform entrances (24px vertical travel, -7° Y / 3° X rotation). Covered/offscreen cards wait; completed cards remain stable. Reduced motion and keyboard focus reveal immediately. Server-rendered cards remain readable with JavaScript disabled. Skip lands at the first collections section and focuses the storefront. Storefront controls remain inert until the final fade has released the intro, so focusing Search cannot pull the page back under the canvas during the handoff.

## Files changed

- `src/components/intro/ScrollIntro.tsx`: frame/render coordination, fade, release, restoration and cleanup.
- `src/components/intro/scrub-timeline.ts`: bounded, reversible latest-target interpolation.
- `src/components/intro/frame-cache.ts`: exact frame lookup, failure notification, directional decoded window, bounded concurrency.
- `src/components/intro/IntroExperience.tsx`: correct Skip destination and focus.
- `src/components/home/CategoryReveal.tsx`: viewport-only reveal queue and reduced-motion handling; forwards the existing list role.
- `src/app/globals.css`: one restrained category transition; removes competing category keyframes and overrides; updates range fallbacks.
- `public/intro/frames.json` and `scripts/extract-intro-frames.mjs`: matching configurable travel distances.
- `tests/intro.test.ts`: bounded-step, convergence, reversal and proportional-distance tests.
- `tests/e2e/intro-scroll-control.spec.ts`: scroll and category regression coverage.
- `tests/e2e/intro.spec.ts`: allows deliberate traversal time; geometry matrix checks restored positions separately from frame cadence.
- `docs/SCROLL_INTRO.md` and this report: implementation and verification notes.

## Checks

- `npm test`: **40 passed**.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**. Two existing tracing warnings remain in `src/app/test/pics/[...slug]/route.ts` (`stat` and `readFile`).
- Targeted ESLint on all modified TypeScript files: **passed**.
- `npm run lint`: **fails on six pre-existing errors and seven warnings in unmodified files**. Errors: render-time `Date.now()` in the product page; `any` in the sitemap and test-image route; synchronous effect state updates in the admin cropper and shell. These were not changed as part of the animation repair.
- `git diff --check`: **passed**.

Production browser checks against a temporary `next start` server: **12 passed** (eight scroll/cadence/idle/reversal, category, Skip/reduced-motion and Search handoff checks, plus four final slow-delivery and missing-frame checks across desktop/mobile Chromium). The temporary production server was stopped after testing. Its log included Next.js `The destination stream closed early` messages during browser navigation/teardown; these were server messages rather than browser page errors.

Visual inspection covered welcome and settled collections at 1532×730 and 390×844 in Chromium and WebKit, retaining the supplied logo, images, gold circles, labels, grid and links. The captured pages reported no browser page errors. Snapshots and JSON records are in ignored `output/scroll-review/` (`chromium-*-collections.png`, `webkit-*-collections.png`, `visual-review.json`, `webkit-review.json`). WebKit stills wait for the storefront/card entrances and disable animations for the final capture; they are layout checks, not WebKit frame-cadence measurements.

The broader development-preview run completed with **33 passed and 9 failed**. One mobile poster check lost its trace resource because a second Playwright job reused the same output directory; the other eight failures occurred as the server began returning the boutique's data-loading error page/HTTP 500. Server logs reported failures loading store settings, homepage content, collections and products. No animation code was changed in response to those data failures. Subsequent read-only backend probes for store settings, homepage settings and products each returned HTTP 200.

The explicit opening-frame-in-flight reload test passed on **desktop and mobile**: the frame request is held, the page reloads before it completes, then the request is released and the intro/Skip destination recover without browser page errors.

The nine affected mobile checks were rerun against a fresh production preview with an isolated artifact directory: **eight passed immediately**. The remaining native touch check expected the old short swipe to advance past frame 0, but that gesture now ends inside the intentionally retained opening/first-frame hold. Its swipe was increased from 64% to 80% of viewport height to cross both holds, and its isolated rerun **passed in 3.5 seconds**. This changes the test gesture, not input handling or the animation timeline. Final direct requests to the existing development homepage and `/product/deno` also returned HTTP 200 without the boutique error page.

**All 44 distinct browser cases have passing results across the primary run and isolated reruns**: 33 from the broad run, nine affected mobile cases from production reruns, and two explicit in-flight reload cases. This is not a claim that one uninterrupted 44-test run passed. The earlier 12 selected production checks also passed, including final slow/missing-frame behavior.

## Requested scenario coverage

| Scenario | Verification |
| --- | --- |
| Gradual scrolling | Small measured progress increments settle to their mapped frames. |
| First and second long advances | Half-range and full-range targets, with displayed frames sampled every RAF. Physical gesture distance varies by input device. |
| Rapid repeated input | Alternating targets retain only the latest destination, including delayed assets. |
| Sustained Arrow Down | Repeated native keydown input remains mapped to actual document position. |
| Native touch | Two touch gestures and a separate swipe across the welcome/first-frame hold advance the mapped sequence. |
| Upward reversal | Samples remain monotonic backward, including reversal all the way to frame 0. |
| Intro completion | Final fade, header Search dialog and returning to reverse scrubbing work. |
| Card entrances | Covered cards wait for intro release; visible cards reveal sequentially and settle. |
| Rapid category traversal | Scrolling to the last card and back retains stable completed cards and valid category links. |
| Resizing | Phone, tablet, landscape, square and desktop geometry; responsive source switching and restored positions. |
| Reload while loading | Opening frame request held in flight across reload, then released; state and Skip recover. |
| Reduced motion | Static intro flow, visible non-animated cards, live preference change and reload. |
| Existing shopping flows | Product availability, quantity, persistent bag, checkout navigation, filters/search, policy routes, narrow layouts and protected admin redirects. |

Automated viewports and touch emulation do not establish physical iOS/Android performance. Changes are local; no production deployment was performed.
