# Peacock scroll intro

The homepage opens with the uploaded “Scroll to Continue” artwork, then reveals the approved supplied MP4 as a scroll-controlled canvas sequence. The video source is preserved in `video/` and is never served, played, regenerated, or used for runtime seeking. The official PNG logo remains unchanged.

## LAN preview initialization

The LAN-only failure was development-server initialization, rather than a different scroll calculation. With the server listening on `0.0.0.0`, Next.js 16.3.8 allowed localhost but rejected the `192.168.0.100` Origin on `/_next/hmr`. The rejected WebSocket also prevented the development React debug stream from completing the initial server response, so hydration remained suspended. `ScrollIntro` never mounted: its `data-ready`, `data-phase`, and `data-frame` attributes were absent, the video remained hidden, and the storefront was not inert.

This was the first causal difference between the two origins. HTML, scripts, CSS, fonts, and intro assets returned successfully on both. At the same 390×844 viewport, both pages already had the same 380px front range, 2954px video range, and 4178px intro height. Forwarding only the LAN HMR connection with an allowed Origin restored hydration and frame progression while leaving the page on insecure LAN HTTP, ruling out secure-context APIs as the cause.

`next.config.ts` now supplies `allowedDevOrigins` from the machine's active, non-loopback IPv4 interfaces. These are exact hostnames without protocols, ports, or wildcard patterns, following the installed Next.js guide. Localhost retains Next's built-in allowance; an unrelated Origin remains blocked. The list is evaluated at server startup, so restart the development server after a network-address change. This option applies to development resources and does not change the production scroll architecture or application origin checks.

The configured server was verified at both `http://localhost:3000/` and `http://192.168.0.100:3000/`. In Chromium and WebKit at 390×844, both now connect the HMR socket, hydrate to the opaque welcome screen with frame 0 and video opacity 0, and show frame 58 with video opacity 1 at scrollY 1400. The runtime comparison is saved in `output/lan-fixed-runtime.json`. No scroll, canvas, camera, frame, or source-media change was needed for this repair.

`tests/e2e/network-origin.spec.ts` protects the live development connection and compares both origins through the complete flow and reversal at every requested width, including native touch on portrait phones and phone landscape. The default LAN URL is discovered from the local interfaces; `E2E_LAN_URL` can select a specific running preview. Run `npx playwright test tests/e2e/network-origin.spec.ts` with the development server available. See `docs/VERIFICATION.md` for current results.

## Initial welcome screen

The uploaded welcome PNG is 1800×874 and is copied byte-for-byte. Its source SHA-256 is `2b1c83ad2922c6f8c2fce6fee3539700bcb0365c6ada6d3a7538862fbccf443f`. The artwork is a visual reference for a responsive full-screen composition: four SVG views retain its corner ornament regions, and a central SVG view uses source rectangle `500 225 800 440` for the original emblem, lettering, subtitle, and arrow. Every view references the same unchanged raster asset. The native lettering is not replaced with a browser font, and no generated image, edited raster, or flattened derivative is created.

Fluid CSS positions the ornament views at the corners and scales the central view inside the viewport. Horizontal and vertical masks soften each view's outer background edges into a warm ivory radial field, while preserving the native central lettering and arrow. This retains the supplied center content across desktop, tablet, and portrait phones. Applying a single portrait `cover` crop to the 1800×874 image would cut its embedded “Scroll to Continue” lettering; the separate source views avoid that crop while keeping the original image pixels.

The front screen and video share one sticky viewport. On the initial frame, the front screen is opaque and the video stage is hidden. Positive native scroll reveals the video under a reversible smoothstep crossfade over 45svh. The video stays on frame 0 throughout that transition; its existing frame progression begins only after the front transition distance has been consumed. There is no extra autoplay timeline or independent transition timer.

## Corrected source and outputs

The active source is `video/achu_master_entrance_corrected.mp4`. Full FFmpeg decoding and OpenCV independently measured 1920×1080, 24 FPS, 307 frames, and 12.7916666667 seconds. The MP4 is never modified by extraction.

The supplied master contains leading “Scroll to Continue” footage. The stage starts at zero-based source frame 67 (2.7916666667 seconds), the last empty frame before the first corrected bird pixels at frame 68. The leading welcome is omitted so it does not repeat behind the existing welcome layer. All 240 source frames from 67 through 306 are retained, in order, at the native 24 FPS cadence. This includes all 44 corrected entrance frames and the actual final source logo. The retained animation spans 10 seconds, established from the inspected source rather than the previous clip's values.

Desktop assets are 1440×810 and mobile assets are 720×405. Each set contains 240 frames. The desktop payload is 21,644,502 bytes (~21.64 MB), and mobile is 8,435,262 bytes (~8.44 MB). The cache revision is `ddcfb6783423`. Both contain the complete 16:9 artwork at one fixed ratio. FFmpeg first decodes native BT.709 footage to lossless RGB PNG intermediates, avoiding the implicit YUV color conversion of direct WebP extraction. After uniform whole-frame resolution reduction, the first 45 output frames (source 67–111, including every corrected entrance frame) use lossless WebP. The unchanged continuation uses quality-90 WebP to reduce network payload without changing frame cadence or composition. There is no crop, portrait padding, late mobile zoom, bird-specific scaling, fade, or temporal resampling. `public/intro/frames.json` records the complete source duration/rate/count/hash, retained range, output count/dimensions/payload sizes, and cache revision. The revision includes the source hash, retained range, native rate, dimensions, and extraction recipe.

## Rendering geometry

The sticky stage, media wrapper, canvas and poster occupy the full visible viewport, with no constrained media width, card styling or side gutters. Monitors, laptops, landscape phones and tablets use uniform cover: `scale = max(stageWidth / sourceWidth, stageHeight / sourceHeight)`. The destination rectangle covers the stage; the canvas clips its overflow. No sampled-edge extension, stretched pixels, blur or repeated strips are rendered. The existing `dvh`/visualViewport visible-height handling and stable `svh` scroll ranges remain in place.

The user approved a portrait-phone crop after reviewing a cover preview: the complete circular logo and bottom lettering take priority. Phones up to 600px wide in portrait show a proportionally scaled 360-pixel-wide central source window on the full-height ivory stage. This enlarges the complete final logo without distorting it; natural ivory remains above and below the image. The camera crop follows the source bird through the entrance and flight, then centers on the logo. The background is one source-matched ivory color, without edge extensions. The server-rendered poster and canvas share this source window and its offsets, including before hydration and in reduced-motion/no-JavaScript flow.

On portrait tablets, the horizontal cover crop starts at the source's left edge to retain the corrected gradual entrance, follows sampled positions of the native bird, then centers on the final logo. The cover scale stays fixed. Landscape screens use a horizontally centered crop with a fixed 72% vertical position to retain the native bottom welcome line in short phone/laptop viewports. Every source frame remains unchanged and in its existing order; crop placement follows the displayed frame, so reverse scrolling retraces it exactly. The `frameSource` rectangle still excludes exported padding when metadata supplies it; the corrected current sets have no embedded export padding and use their full source bounds.

The existing welcome, reversible 45svh transition, frame holds, animation timing, final storefront fade and native scroll input remain unchanged.

## Asset generation workflow

With FFmpeg available, run:

```powershell
npm run intro:extract -- video/achu_master_entrance_corrected.mp4 --start-frame 67 --lossless-frames 45
```

`FFMPEG_PATH` and `FFPROBE_PATH` can override executable locations. FFprobe measures native metadata when available; a full FFmpeg decode verifies constant integer-rate timing when FFprobe is unavailable. Unsupported or variable-rate timing is rejected rather than guessed. Extraction retains every native frame through lossless RGB intermediates, verifies the output count, stages both complete sequences before publishing, and removes only obsolete generated frame filenames. Temporary paths are verified before cleanup. Production does not need FFmpeg. Inspect a replacement's actual welcome/entrance boundary before selecting its start frame.

## Integration

The home route remains `/`. `src/app/(home)/layout.tsx` places the intro before the shared server-rendered storefront. The existing homepage content is retained in that group; other public routes remain in `src/app/(storefront)`. Both use `src/components/layout/storefront.tsx`. Only the home layout imports the intro and frame metadata. Ecommerce APIs, cart, database, and admin functionality are unchanged.

`ScrollIntro.tsx` uses native passive scroll events, sticky CSS, refs, and a demand-driven RAF. The uploaded welcome views are the `.intro-front` layer, and `.intro-video-stage` wraps the existing poster, media frame, and canvas. There are no new scroll libraries, intercepted wheel/touch gestures, autoplay, audio, or video controls. Mobile swipes, momentum scrolling, and desktop wheel/keyboard input retain normal browser behavior. Frame interpolation settles within about 100 ms after native scrolling stops; no separate playback timeline runs.

Scroll distance is split into two measured ranges: `.intro-front-range` is 45svh; `.intro-video-range` is 300svh on landscape screens and 350svh on portrait screens. The section's normal height is their sum plus the visible 100dvh sticky stage. Video progress is `clamp((scrollTravel - frontRange) / videoRange)`, so the added opening does not consume any of the existing video period. The 300svh desktop period retains its previous timing and feel. Stable `svh` range measurements keep mobile address-bar expansion or collapse from advancing the sequence; `dvh` changes only the visible stage dimensions. Orientation changes recalculate source selection and geometry.

An additional mobile compatibility failure was reproducible when `svh` and `dvh` were unsupported: direct viewport-unit declarations became invalid, both range helpers collapsed to zero, and the first scroll completed the animation immediately. The compiled CSS had also removed preceding duplicate `100vh` height declarations, so those declarations did not provide a fallback. Viewport dimensions now use two scoped custom properties on `.home-experience`, both initially `1vh`. Separate `@supports` rules upgrade `--intro-stable-vh` to `1svh` and `--intro-visible-vh` to `1dvh`. All intro distances, stage heights, poster offsets, and reduced-motion/no-JavaScript flow heights use these properties. The defaults and feature-query upgrades both remain present in the optimized CSS.

When an upgraded unit is unavailable, JavaScript measures `visualViewport.height`, falling back to `innerHeight`, and supplies the corresponding property in pixels. On touch devices, the stable height remains fixed during height-only address-bar changes at the same document width and orientation; the visible height continues to resize the stage. Width or orientation changes reset the stable measurement. On desktop, ordinary viewport resizing updates both fallback measurements. Browsers supporting both units keep the existing CSS geometry without JavaScript height overrides. Before hydration and without JavaScript, the `1vh` defaults keep the stages and native scroll ranges valid.

Within the video period, the first frame still holds for 4%; animation finishes at 88%; the logo holds through 96%; the last 4% fades into the store. One viewport of overlap removes an empty screen at release. The opaque ivory layer covers the store until the fade, and covered ecommerce controls are inert. Absolute scroll position controls both phases, so upward scrolling reverses the video and restores the opening screen. The diagnostic phase distinguishes `welcome`, `transition`, `video`, and `store`, with `static` for reduced motion. Fast swipes and restored scroll positions can enter any phase directly without waiting for a transition timer or an asset-loading lock.

A server-rendered responsive picture supplies the video's first frame before hydration, while the welcome artwork is already visible. Reduced motion uses two static 100dvh stages in normal document flow: the welcome screen followed by the completed logo, requesting only the final frame. Without JavaScript, the same two-stage flow shows the welcome screen followed by the static video poster. Both modes remove the long scrub ranges, sticky overlay, and overlapping store margin, so the store remains reachable through ordinary scrolling. The welcome artwork is a focusable continue link to the video anchor. Once the video phase is reached, the existing focus-visible skip link provides direct keyboard access to the store. Restored scroll positions, resize, orientation changes, and reverse scrolling are supported. No permanent/session skipping is implemented.

The configured floating WhatsApp button stays hidden before hydration and throughout the active intro. In reduced-motion mode, it remains hidden until native scrolling reaches the store below the two static stages; store controls retain their normal accessibility. Without JavaScript, the button becomes a visible absolute-positioned element inside the store rather than a viewport-fixed overlay, so it does not cover the opening artwork. The store's regular contact links remain available.

## Performance

Only the selected portrait or landscape sequence is fetched. The cache can prepare frame 0 while the welcome screen is visible, and prioritizes the current target and nearby frames, the opening frames, and the ending frame. Three concurrent fetches progressively retain compressed blobs; two concurrent decodes populate a bounded image window. Mobile retains at most 12 decoded frames and desktop at most 16, with up to two temporary in-flight decodes. Evicted bitmaps are closed and fallback image references released. Compressed blobs enable reverse decoding without repeating network requests. Unmount aborts fetches and cleans up RAF, listeners, bitmaps, and object URLs.

DPR is capped at 2, with an additional three-million-pixel canvas budget. Canvas allocation uses the visible viewport; source rectangles exclude only the synthetic export padding. The old decoded set remains available while a responsive replacement loads. The homepage hero defers its large images until the store approaches the viewport. Frame URLs carry the asset revision and receive cache headers.

Under constrained bandwidth, the poster and nearest decoded frame remain available while target frames load. Fast scrolling always permits entering the store; asset loading never locks scrolling. Physical phone frame rates and final CDN throughput still need deployment testing.

## Checks

Geometry checks compare the selected source rectangle, media-container dimensions, canvas dimensions, and poster alignment. Both scale axes must match and the canvas must match the actual sticky stage; landscape cover must reach all edges, while the approved portrait phone window must retain the complete central logo and lettering. Include browser scrollbar widths. Check early entrance, flight, transformation, the actual final logo, reverse scrolling, and orientation changes on portrait and landscape screens. Verify source preservation by comparing every decoded WebP with independently decoded MP4 frames after the same uniform resolution reduction: corrected entrance pixels must match exactly; continuation compression must remain within its measured RGB quantization tolerance.

```powershell
npm test
npm run typecheck
npm run lint
npm run test:e2e
npx playwright install webkit
npx tsx scripts/intro-visual-qa.ts
npm run build
```

Tests should cover the opaque opening screen, complete central welcome lettering on portrait phones, positive-scroll crossfade, stationary frame 0 until the front range ends, and unchanged desktop video progression after that offset. Further checks cover forward/reverse scrubbing, final hold, fade, restored scroll, responsive switching, native keyboard/touch scroll, stable range measurements during viewport-height changes, reduced-motion/no-JavaScript static flow, delayed/unavailable frames, Image.decode fallback, and no intro requests on shop/product/cart/checkout/admin routes. Existing storefront checks verify products, search, cart, checkout, and protected routes.

Visual QA captures eleven stages—welcome, reveal, first video frame, entrance, flight, transformation, logo, release, store, reverse entrance, and reverse first frame—at 320×760, 375×812, 390×844, 430×932, 768×1024, 1024×1366, 1366×768, 1440×900, 1920×1080, 844×390, and 1024×768 in Chromium and WebKit. The matrix produces 242 snapshots with page-error, missing-frame, opacity, full-viewport stage-box, and overflow checks. The script also exercises startup and store access at 750 kbps and 150 ms latency. Screenshots/report are saved in ignored `output/intro-cover-qa/`. Browser engines and simulated viewports do not replace physical iOS/Android testing.

Earlier compatibility verification emulated unsupported viewport units by invalidating `svh`/`dvh` in served CSS and returning false for the matching JavaScript feature checks. After the fix, a 120-pixel mobile scroll remains in the welcome transition on frame 0 instead of releasing the store. At 390×844, resizing the visible viewport height to 744 and then 894 at scroll position 1400 retained the 380-pixel front range, 2954-pixel video range, frame 58, and store document offset. Emulated legacy reduced-motion and no-JavaScript modes each retained two 844-pixel flow stages with the store at 1688 pixels. Modern desktop geometry was also checked at 1366×768, 1532×730, and 1920×1080 with no fallback overrides or horizontal overflow. This reproduces and verifies the compatibility failure class; it does not identify the user's physical browser version.
