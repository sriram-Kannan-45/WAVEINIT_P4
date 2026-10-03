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

## Source and outputs

`ffprobe` confirmed 1920×1080, square pixels, 16:9, exactly 10 seconds, 24 FPS, and 240 video frames. The background is warm ivory, rather than pure white. The bird's initial partial silhouette at the left edge is already present in the approved footage.

Source SHA-256: `02b9fa839a07586b40358f57b2aa38cd26fe684c1afc029d82398d2dcc9602d9`.

| Set                 | Dimensions | Frames | Encoded payload            |
| ------------------- | ---------- | ------ | -------------------------- |
| Desktop / landscape | 1440×810   | 160    | 7,473,144 bytes (~7.47 MB) |
| Mobile / portrait   | 720×1280   | 160    | 3,962,418 bytes (~3.96 MB) |

Sampling uses 16 FPS equivalent. WebP quality is 82 during movement and 90 in the final portion; the last asset uses the actual final source frame. `public/intro/frames.json` supplies dimensions, paths, counts, background, timing, revision, payload sizes, and the active source rectangle for each padded mobile frame.

A fixed portrait cover crop would cut off the flight and logo. The existing mobile sequence retains the landscape flight and circular transformation, then smoothly reframes from 7.75–9.5 seconds toward the central 1000×1080 area containing the completed emblem and welcome text. This existing reframe is retained by the sizing fix; no new camera movement is added. The previously exported mobile files contain ivory padding around their active image. Rendering now excludes that padding through source coordinates, without rewriting the image files or repainting their artwork.

## Rendering geometry and padding fix

The animation is a 2D canvas sequence of supplied video frames. There is no Three.js mesh, texture UV mapping, WebGL camera, or CSS 3D transform in this pipeline; the dimensional effect is already present in the footage.

The whitespace originated during mobile export. Early frames contain a 720×405 landscape image centered inside a 720×1280 file, with approximately 437 pixels above and 438 pixels below. The previous renderer scaled this padded file rather than its actual image region, used a hardcoded 800-pixel height reference, and drew into a viewport-sized canvas. The poster followed separate sizing rules. Edge gradients then concealed some padding boundaries without correcting the source-to-frame mapping.

Each mobile frame now records its exact active image rectangle, including the integer rounding used by the original export. The renderer uses the nine-argument `drawImage()` overload to read that rectangle only. Desktop uses its complete 1440×810 source region. The `.intro-media` container and canvas have the active region's aspect ratio, and the region fills that container without internal padding. Poster framing uses the same source geometry before hydration and in reduced-motion mode. Edge gradients and the hardcoded height reference are removed.

The media frame fills the actual sticky stage's entire width. Its uniform scale is `stageWidth / sourceWidth`, its left offset is zero, and its natural height is `sourceHeight * scale`. There is no maximum-height or contain rule that can inset the source's left and right edges. `.intro-media` uses `width: 100%` and the active source aspect ratio. Explicit zero-minimum grid tracks keep vertically oversized media aligned within the stage; the stage clips any vertical overflow. Canvas resolution follows the media frame and its device-pixel ratio, with the same aspect ratio on both scale axes. Resize, orientation changes, source-set changes, and the existing late mobile reframe recalculate these bounds.

Vertical alignment starts at the normal centered offset `(stageHeight - mediaHeight) / 2`. A fixed composition band from 13% to 95% of the active source height covers the finished emblem and welcome text with a margin. When that band fits in the stage, the centered offset is adjusted only as much as needed to keep the band visible. The permitted offset interval is `[-0.13 * mediaHeight, stageHeight - 0.95 * mediaHeight]`. If the band itself is taller than the stage, overflow remains centered. The same fixed band applies throughout the sequence; no moving-subject detection, per-frame focus tracking, or final-hold alignment jump is added. Frames that fit vertically remain centered.

The server-rendered video poster applies the same alignment before hydration and in reduced-motion mode. Its shift relative to the centered grid position is clamped between `37% - half the visible viewport height` and `half the visible viewport height - 45%`, with zero as the preferred shift. On browsers supporting dynamic viewport units these are equivalent to `37% - 50dvh` and `50dvh - 45%`; older browsers use the shared visible-height fallback described below. For landscape stage aspect ratios above `800/369`, the desktop composition band cannot fit and the poster keeps centered overflow. Hydration computes the displayed source's exact geometry from the actual container dimensions. Video sizing has no side gradients, blurred extensions, overlays, or painted filler; the welcome screen's ivory field is separate from the footage mapping.

This fix does not regenerate the MP4, WebPs, reference images, or official logo. It removes only implementation-added padding from the mapped region. Native background within a source frame remains part of the image.

Full-width rendering preserves aspect ratio but cannot also guarantee full-height coverage or complete artwork visibility at every viewport shape. A 16:9 frame at 390 pixels wide is about 219 pixels tall; its side edges touch the phone viewport while the unchanged 100dvh stage remains the scroll and transition environment. On wider, shorter viewports, the natural media height exceeds the stage and vertical clipping is mathematically necessary. The fixed focus band avoids unnecessary cropping of the completed emblem and text when they can fit: at 1532×730, the media is about 862 pixels tall and needs only a small upward alignment adjustment to retain them. At 1920×800, the finished emblem and welcome text together span approximately 848 pixels vertically, so no positioning rule can show all of them at full width without distortion.

Artwork reaches each source edge at different points in the sequence: the entering bird on the left, a raised wing at the top, transformation details at the bottom, and butterflies on the right. There is no single safe portrait crop across the whole sequence. Source rectangles remove only the existing synthetic padding; additional source cropping, new camera composition, and image regeneration are not used to conceal the viewport-shape tradeoff.

## Asset generation workflow

The rendering fix reuses the existing assets and does not run extraction. The following workflow is for deliberately rebuilding assets from the approved clip.

Install FFmpeg and ffprobe on the development machine, then run:

```powershell
$introSource = (Get-ChildItem -LiteralPath '.\video' -Filter '*.mp4' | Select-Object -First 1).FullName
npm run intro:extract -- $introSource
```

`FFMPEG_PATH` and `FFPROBE_PATH` can override executable locations. Extraction uses temporary lossless WebP intermediates and deterministic filenames. Temporary paths are verified before cleanup. Production does not need FFmpeg. Inspect any replacement video before changing this reviewed framing; a different resolution or duration is rejected.

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

DPR is capped at 2, with an additional three-million-pixel canvas budget. Canvas allocation uses the aspect-matched media frame; source rectangles exclude only the synthetic export padding. The old decoded set remains available while a responsive replacement loads. The homepage hero defers its large images until the store approaches the viewport. Frame URLs carry the asset revision and receive cache headers.

Under constrained bandwidth, the poster and nearest decoded frame remain available while target frames load. Fast scrolling always permits entering the store; asset loading never locks scrolling. Physical phone frame rates and final CDN throughput still need deployment testing.

## Checks

Geometry checks should compare the selected source rectangle, media-container dimensions, canvas dimensions, and poster alignment. The media ratio must equal the active source ratio, both scale axes must match, and the media's left and right edges must equal the actual sticky-container edges, including non-overlay browser scrollbars. Check natural-height overflow and focus-band alignment on wide laptops as well as early flight, transformation, completed logo, reverse scrolling, and orientation changes. Inspecting only the last logo frame would miss the early landscape padding bug. Source and asset hashes should remain unchanged by a rendering-only fix.

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

Visual QA captures eight stages—welcome, reveal, first video frame, flight, transformation, logo, release, and store—at 320×760, 375×812, 390×844, 430×932, 768×1024, 1024×1366, 1366×768, 1440×900, 1920×1080, 844×390, and 1024×768 in Chromium and WebKit. The matrix produces 176 snapshots with page-error, missing-frame, opacity, full-viewport stage-box, and overflow checks. The script also exercises startup and store access at 750 kbps and 150 ms latency. Screenshots/report are saved in ignored `output/responsive-flow-qa/`. Browser engines and simulated viewports do not replace physical iOS/Android testing.

Compatibility verification emulated unsupported viewport units by invalidating `svh`/`dvh` in served CSS and returning false for the matching JavaScript feature checks. After the fix, a 120-pixel mobile scroll remains in the welcome transition on frame 0 instead of releasing the store. At 390×844, resizing the visible viewport height to 744 and then 894 at scroll position 1400 retained the 380-pixel front range, 2954-pixel video range, frame 58, and store document offset. Emulated legacy reduced-motion and no-JavaScript modes each retained two 844-pixel flow stages with the store at 1688 pixels. Modern desktop geometry was also checked at 1366×768, 1532×730, and 1920×1080 with no fallback overrides or horizontal overflow. This reproduces and verifies the compatibility failure class; it does not identify the user's physical browser version.
