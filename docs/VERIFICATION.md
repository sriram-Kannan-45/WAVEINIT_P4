# Verification — 2 October 2026

## LAN-origin hydration repair

- Reproduced the failure on the actual LAN URL at the same browser/viewport as localhost. The first causal divergence was the rejected `/_next/hmr` WebSocket: Next's development origin guard allowed localhost and the startup hostname `0.0.0.0`, but not the machine's LAN IP. The development React debug channel left hydration suspended, so the intro's effect and scroll listener never initialized. HTML, assets, viewport dimensions, and measured scroll ranges matched.
- Isolated the cause by allowing only the LAN HMR connection in a diagnostic control. The unchanged insecure LAN page then hydrated and rendered advancing frames. This ruled out `isSecureContext`, bitmap decoding, texture paths, viewport units, and different responsive calculations as the cause of this origin-specific failure.
- Added exact active non-loopback IPv4 hostnames to `allowedDevOrigins` in `next.config.ts`, without hardcoding an IP or changing application scroll logic. Next restarted and both preview URLs returned HTTP 200. Development JavaScript requests with localhost and LAN Origin headers returned HTTP 200; an unrelated Origin still returned HTTP 403.
- Chromium and WebKit runtime comparisons at 390×844 passed on both origins: connected HMR, initial opaque welcome/frame 0/hidden video, then visible video/frame 58 at scrollY 1400. Geometry and scroll state now match; the expected secure-context difference remains. All four runs recorded no console/page errors or failed assets. Details are in `output/lan-fixed-runtime.json`.
- The five new network-origin browser tests passed, with five intentional project skips. They require live HMR frames and connection status on the actual URLs, compare initial runtime state, exercise intro → video → storefront and reversal, and reject page/console/WebSocket errors or non-aborted transport failures. Coverage includes 320, 375, 390, 430, 768, 1024, 1366, 1440, and 1920px on both origins, plus 844×390 phone landscape. The four portrait phones and phone landscape use native Chromium touch input, including slow swipes, fast momentum swipes, and reversal. These are browser simulations, not physical-device verification.
- Localhost regression checks passed again: 40 intro/welcome/storefront browser checks, with 6 platform-specific cases intentionally skipped; 15 unit tests; strict TypeScript; ESLint; and optimized production build. These include the preserved desktop timing, native slow/fast swipes, reverse scrolling, resize/orientation, poster geometry, frame decoding fallback, reduced motion, and the existing storefront.
- All 324 existing image/video assets were checked again and remain byte-for-byte unchanged. No scroll-system rewrite, video replacement, animation change, or image regeneration was introduced for this LAN fix.

## Mobile stage bypass repair

- Reproduced a concrete compatibility failure: unsupported `svh`/`dvh` collapsed both scroll-distance helpers and the intro section to zero, so even a tiny scroll could release the website. The compiled stylesheet had discarded the earlier duplicate `100vh` declarations, leaving no working height fallback.
- Replaced direct intro viewport units with scoped `1vh` defaults and separate feature-query upgrades. The defaults and `@supports` rules survive both development and optimized production CSS. Where a unit is unavailable, measured `visualViewport.height`/`innerHeight` supplies the visible stage height; the touch scroll range stays stable during height-only changes and resets on width/orientation changes. Modern desktop uses the same supported units, timing, geometry, and transitions as before.
- Runtime phases now distinguish the completed storefront from the visible video. Tests verify the canvas and opaque parent actually intersect the viewport; a terminal frame number or `data-phase` alone no longer counts as evidence of visible animation.
- Current checks passed: 15 unit tests, 32 existing intro/storefront browser checks, 8 welcome checks, and 6 additional responsive-flow checks, with 12 platform-specific cases intentionally skipped. Strict TypeScript, ESLint, and optimized production build also passed. Verification includes all nine requested widths, phone/tablet landscape, legacy-unit simulation with and without JavaScript, stable fallback ranges on height changes, native slow swipes, repeated fast flicks, actual flying-frame exposure before the website, and reverse scrolling.
- Chromium and WebKit captured all eight stages at 11 viewport sizes, producing 176 snapshots in `output/responsive-flow-qa/`. Both engines recorded zero page errors, missing intro assets, or horizontal overflow; video-stage boxes filled the viewport throughout their active period. The 750 kbps/150ms development check also retained store access, with first canvas readiness in 19.92 seconds. These are browser simulations, rather than physical phone checks.
- All 324 existing media files remain byte-for-byte unchanged. No video extraction, frame regeneration, source-image edit, gesture interception, or scroll locking was introduced. Existing reduced-motion behavior retains its static peacock stage.

## Scroll to Continue opening

- Added the supplied PNG as the first opaque, full-viewport screen. Responsive SVG views keep the original lettering, emblem, arrow, and corner artwork readable on portrait screens; all views use the same byte-for-byte PNG, with no generated or edited raster. Its SHA-256 is `2b1c83ad2922c6f8c2fce6fee3539700bcb0365c6ada6d3a7538862fbccf443f`.
- A reversible native-scroll crossfade reveals the existing peacock over 45svh. Frame 0 remains held during the reveal. The original desktop 300svh and portrait 350svh video periods, frame holds, interpolation, and final storefront fade are preserved after that offset. Passive scroll events support finger input and momentum without intercepting touch or wheel events. Stable `svh` ranges and a `dvh` visible stage handle mobile viewport changes independently.
- Current verification passed: 15 unit tests; 20 intro and 12 storefront browser checks; 8 welcome checks, with 6 platform-specific cases intentionally skipped; strict TypeScript; ESLint; and optimized production build. The reduced-motion checks were also repeated after the final visibility adjustment.
- Native Chromium touch input passed slow swipes, fast swipes, unheld momentum flicks, and reverse scrolling at 320, 375, 390, and 430px. Checks cover initial video hiding, one-swipe reveal, no horizontal overflow, scroll traces without application jumps, viewport resizing, and unchanged desktop video timing. Browser emulation does not verify a physical phone's browser chrome or frame rate.
- Chromium and WebKit visual QA passed at 320×760, 375×812, 390×844, 430×932, 768×1024, 1366×768, and 1920×1080. Eight stages per size produce 112 snapshots under `output/welcome-qa/`: opening, half reveal, first video frame, flight, transformation, logo hold, release, and store. Both engines recorded zero page errors, missing intro assets, or horizontal overflow. Representative phone/laptop opening and transition images were visually inspected.
- The reduced-motion and no-JavaScript flows retain the opening followed by a static video section in normal document flow; the storefront stays reachable. At 750 kbps with 150ms latency, the development preview kept the opaque opening and permitted storefront access; first canvas readiness took 19.88 seconds. This includes the original 2MB PNG and development bundles.
- The original 324 media files remain byte-for-byte unchanged. No extraction or video regeneration ran for this change.

## Frame rendering repair

- Traced the supplied MP4 through extraction, stored WebPs, frame caching, poster CSS, and canvas drawing. This is a 2D frame sequence; no Three.js mesh or CSS 3D transform is present.
- Corrected source-to-frame geometry: per-frame rectangles exclude synthetic mobile export padding; the media container, canvas, and SSR poster share the active footage aspect ratio. The actual media now spans 100% of the sticky viewport width, with its source edges at both container edges. The previous height-based width cap is removed. The fullscreen scroll stage and existing animation timing/reframe remain unchanged.
- All 324 checked media files (320 WebPs, source MP4, official logo, and both supplied reference images) are byte-for-byte unchanged, verified against SHA-256 values captured before the repair.
- Current checks passed: 14 unit tests, 20 desktop/mobile intro browser tests, strict TypeScript, ESLint, and production build.
- Current width-specific Chromium and WebKit visual QA passed at six sizes and three stages each: 36 snapshots under `output/full-width/`. Each confirms the actual media touches both viewport edges without horizontal overflow. Sizes include 1366×640, 1532×730, 1920×900, 1920×800, phone, and tablet.
- A fixed normalized vertical focus band (0.13–0.95) preserves the completed emblem and welcome text when that region fits after width scaling. Very short, wide viewports require vertical clipping; those use centered overflow when the band cannot fit. No image stretching, horizontal crop, background overlay, or moving-subject tracking is used.

## Completed locally

- Optimized Next.js production build: passed.
- Strict TypeScript: passed.
- ESLint: passed without warnings.
- Validation and utility tests: 13 passed, including image-byte validation, corrupted-cart rejection, request-origin rules, intro mapping, safe canvas geometry, complete WebP sequences, payload totals, and the preserved source-video hash.
- PostgreSQL migration/security/transaction suite: passed. The unchanged migrations execute in PGlite with PostgreSQL `pgcrypto` and `pg_trgm`; minimal Supabase auth/storage scaffolding is used only by tests.
- Playwright: 28 desktop/mobile tests passed. The 12 original storefront checks passed alongside 16 intro checks for scrubbing, stationary/held frames, reverse/release behavior, restored positions, resize/orientation, touch/keyboard scrolling, reduced motion, slower loading, unavailable frames, Image.decode fallback, and route isolation.
- Overflow checks: seven public/login layouts at 320, 375, 430, 768, 1024, 1440, and 1920 px passed.
- Official logo: source and project copy have identical SHA-256 hashes: `F3B368A2DD4BECEC9154D0B0C4F5D05A6E76CCFABF9985507347824944307A0F`.
- Server-only service-role access: protected by `server-only` and server action/route boundaries; no service-role environment variable references appeared in generated browser chunks.

PostgreSQL tests cover actual CRUD, preserved variant IDs, attached-category deletion protection, stock constraints, non-admin isolation, public catalog filters and publication rules, atomic enquiry snapshots, unchanged stock on enquiry, idempotent retries, stale-price/stock rejection, persistent rate limits, private customer records, storage RLS, and preserved history after product deletion.

## Live launch checks still required

No Supabase credentials or hosted account were supplied. Supabase Auth login/session expiry, actual object-service uploads, deployed HTTP mutations, and an enquiry against the final hosted Supabase project remain unverified. Automated tests verify PostgreSQL storage authorization, not the external object service itself.

The real boutique inventory, contact details, size measurements, policy text, and final domain also need to be supplied. The README gives the exact setup, migration, owner initialization, and Vercel deployment steps. No external WhatsApp messages were sent.

## Preview snapshots

The earlier edge-gradient workaround has been replaced by exact source-to-media geometry. The image fills its media frame without synthetic internal padding, and that frame fills the complete available width. See the current width-specific snapshots above and `docs/SCROLL_INTRO.md` for vertical alignment and clipping behavior.

The approved MP4 intro was analyzed with ffprobe and inspected through representative contact sheets. Both extracted sequences contain 160 correctly sized WebP frames. The original video hash matches the manifest. See `docs/SCROLL_INTRO.md` for source data, framing, sizes, and regeneration.

The preceding source-padding repair was also checked with `npx tsx scripts/intro-visual-qa.ts` in Chromium and WebKit at 360×800, 390×844, 430×932, 768×1024, 1366×768, and 1920×1080. Each engine captured the first frame, flight, transformation, logo hold, release, and store: 72 snapshots with no page errors, missing frames, or horizontal overflow. Those earlier screenshots and `report.json` remain under `output/intro-qa/`; the latest width-specific screenshots are under `output/full-width/`.

At 750 kbps and 150 ms latency, the development preview retained its responsive poster before canvas hydration and allowed store access during progressive frame loading. First canvas readiness took about 16 seconds with development bundles. The optimized production preview delivered the first poster response in 576 ms and rendered the canvas in 5.36 seconds under the same throttle, with no page errors. Production resize, storefront release, caching headers, and the no-JavaScript SSR fallback also passed. Physical iOS/Android devices and the final CDN remain deployment checks.

Run `npx tsx scripts/visual-qa.ts` with the development server running to create local, git-ignored screenshots under `output/`. The script checks all seven viewport sizes and captures desktop/mobile homepage and product layouts.

Next.js streamed not-found pages may return HTTP 200 after streaming has started; their rendered not-found UI carries `noindex`. Non-streamed responses return HTTP 404. Browser coverage checks the branded error screen and the noindex directive according to this framework behavior.
