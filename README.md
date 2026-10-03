# WAVEINIT_P4 — Achu Designer Boutique

A complete Next.js storefront and owner panel for a boutique catalog with size-based inventory and WhatsApp enquiries. The supplied official logo is preserved byte-for-byte in `public/brand/achu-designer-boutique-logo.png`.

## What is included

- An editorial, mobile-first storefront: homepage, shop, combined search and filters, collections, categories, multiple-image product galleries, size guide, about, contact, and policy pages.
- Zustand shopping bag persisted in localStorage. Cart availability and prices refresh from the database; checkout validates again inside a PostgreSQL transaction.
- Guest checkout with React Hook Form and Zod, Indian phone and pincode validation, integer-paise display calculations, and server-computed decimal enquiry totals.
- Durable enquiry references, price/name/size snapshots, idempotent retries, persistent serverless rate limits, and an encoded WhatsApp handoff. The customer must send the message and the boutique must confirm the order. No online payment or automatic stock deduction.
- Supabase Auth for owners, explicit admin roles, protected pages, authorization inside every server action, and PostgreSQL RLS.
- Product CRUD with transactional image/variant/collection saving; draft/published/hidden states; category and collection CRUD; inventory editing; enquiry management; homepage CMS; store settings; editable policies; account password changes.
- Supabase Storage uploads with client optimization, previews, ordering, cover selection, alt text, MIME and file-signature checks, and a 3 MB server limit.
- SEO metadata, canonical links, sitemap, robots, real-product JSON-LD, accessible dialogs, loading/error/empty states, reduced-motion support, and secure headers.

## Stack

Next.js 16.3.8 (the stable npm release verified during implementation), React 19, TypeScript, App Router, Tailwind CSS 4, Lucide, Radix Dialog primitives, Supabase PostgreSQL/Auth/Storage, Zustand, React Hook Form, Zod, and Sonner. Vercel is the intended hosting platform.

## Local setup

Use Node.js 22 or newer (development was verified with Node 24).

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The owner login is at `/admin/login`.

Without Supabase, development displays clearly labeled illustrative fixtures. These are centralized in `src/lib/demo.ts`; they are not actual stock. Live enquiry creation and admin login are disabled. Once Supabase credentials are supplied, all catalog data comes from Supabase, including an empty database. A database failure never silently switches to demo data.

Production hides fixtures by default. To inspect a production build locally with illustrative content, explicitly set `ALLOW_DEMO_PREVIEW=true`; leave it false for your live boutique.

## Environment variables

| Variable                        | Purpose                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project HTTPS URL                                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key; safe only with the provided RLS policies                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only service-role key for the controlled enquiry transaction and rate limits                         |
| `NEXT_PUBLIC_SITE_URL`          | The final HTTPS site origin, used for canonical URLs, WhatsApp product links, and sitemap                   |
| `ALLOW_DEMO_PREVIEW`            | Explicit production preview override; default false                                                         |
| `NEXT_PUBLIC_GA_ID`             | Optional Google Analytics measurement ID; leave blank until your privacy/consent requirements are addressed |

Never prefix the service-role key with `NEXT_PUBLIC_`. Do not commit `.env.local` or paste secrets into chat. Keep Supabase configuration consistent between build and runtime.

## Supabase database setup

Create a Supabase project. In the SQL editor, run these files in this order, once each:

1. `supabase/migrations/001_boutique.sql`
2. `supabase/migrations/002_admin_reporting.sql`

Alternatively, link your Supabase CLI project and use `supabase db push`. These are ordered migrations, not scripts intended to run repeatedly.

The migrations include tables, constraints, foreign keys, indexes, timestamps, RLS, transactional RPCs, reporting RPCs, initial settings, unpublished policy notices, and the storage bucket/policies. Actual boutique inventory is not seeded.

If you want optional test categories in an isolated development database, run `supabase/seed.example.sql`. Every record is explicitly named as a sample. Do not run this seed against production.

## First owner account

1. In Supabase Authentication → Users, create the owner with a strong password and a confirmed email. Do not add a public signup route. Disable public signup in the Supabase Auth project settings if it is not needed.
2. Copy that user's UUID and run this controlled SQL as the project owner:

```sql
insert into public.admin_roles (user_id)
values ('REPLACE_WITH_OWNER_AUTH_USER_UUID');
```

3. Sign in at `/admin/login`. An authenticated user without this role cannot access private enquiries or mutate boutique data. Owners cannot grant themselves or other users admin access through the app.
4. Enable appropriate Supabase Auth protections and keep the owner credentials private. Password changes require reauthentication with the current password.

To revoke access:

```sql
delete from public.admin_roles
where user_id = 'REPLACE_WITH_OWNER_AUTH_USER_UUID';
```

## Storage

The `boutique` public-read bucket is created by migration 001 with these logical folders:

- `products/`
- `categories/`
- `collections/`
- `banners/`

Only an authenticated admin can upload, update, or remove objects. Images are optimized in the browser to a maximum 2048 px edge, uploaded as WebP, then checked by the server for MIME type, actual file signature, dimensions, and a maximum 3 MB size, below [Vercel's function payload ceiling](https://vercel.com/docs/functions/limitations). Original input is limited to 20 MB before optimization. SVG and non-image files are rejected.

The official logo is a local, unchanged asset and does not pass through the uploader. Next/Image provides display optimization without altering the source file.

The picker removes images from a product's saved image list; it does not automatically delete storage objects, because images might be shared by other content or referenced in an unsaved edit. Unattached objects from abandoned edits can be reviewed and deleted in Supabase Storage. Keep a backup and verify references before removing them.

## Populate your boutique

1. **Store settings:** add the real WhatsApp number with country code (digits only), phone, address, opening hours, Instagram URL, email, Google Maps directions URL, and the Google Maps **embed URL** (not an iframe HTML snippet). Leave missing details blank. Add your actual brand story and size measurements with units.
2. **Policies:** replace the initial unpublished notices with applicable shipping, returns/exchanges, privacy, and terms. No fabricated delivery promises or legal policy claims are supplied.
3. **Categories / collections:** add active categories, upload images, and set display order. A category with products cannot be deleted until those products are reassigned or removed. Deleting a collection only removes its product associations.
4. **Products:** enter genuine prices/details, upload photos, select one cover, reorder images, add alt text, choose category/collections, and enter stock for each size. Publish when ready. Existing size names retain their variant IDs when edited; changing a size creates a new variant and old bags must be refreshed.
5. **Homepage:** choose hero and optional mobile photos, update heading/CTAs, select a featured collection, configure promotional content, and toggle sections. Use local destinations such as `/shop` or `/collections/festive-edit`.
6. **Inventory:** update stock for each size. Zero stock disables that size, and zero total active stock marks the product out of stock. Inventory remains manual in Phase 1.
7. **Order enquiries:** expand a reference for delivery details and snapshot items, update status, and open the customer's WhatsApp chat. Opening the chat does not send a message.

## Checkout and security model

The server accepts only validated customer input and product/variant IDs, quantities, and expected prices. It reads current product prices and stock, checks active categories/products/variants, rejects changed prices and insufficient stock, and saves the enquiry plus all child snapshots in one transaction. Share locks prevent prices and stock from changing during snapshot creation. Cart totals and product names in localStorage are never trusted by the enquiry endpoint.

References use a server-generated date in Asia/Kolkata plus 48 cryptographic random bits, with a unique database constraint. UUID idempotency keys serialize retries and a request hash prevents reusing a key for changed input.

`create_enquiry` and `consume_rate_limit` are executable only by the server service role. Public users cannot insert into or read order tables. Admin writes use the user's session and RLS. Admin roles are explicitly provisioned through controlled SQL. Policies render as plain text; script-sensitive JSON-LD characters are escaped.

The enquiry endpoint checks same-origin requests and payload length. Rate limits persist in PostgreSQL across serverless instances; [Vercel's client-address header](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for) is hashed with a server secret, and raw addresses are not stored. Local development shares a local limiter. If hosting somewhere other than Vercel, adapt the trusted client-address source before launch. Supabase additionally manages Auth rate limits; when the service key is configured, login has an application-level limiter too.

No stock is reserved or deducted when an enquiry is created. Multiple customers can enquire about the same remaining piece; the boutique confirms availability in conversation. A future confirmed-order/payment flow should implement atomic stock reservation, rather than treating these enquiries as completed orders.

## Verification

The approved peacock-to-logo scroll intro runs on `/` only. It uses separate 160-frame WebP sequences for portrait and landscape, a progressive canvas cache, a final-logo hold, and a reversible fade into the existing store. See [docs/SCROLL_INTRO.md](docs/SCROLL_INTRO.md) for regeneration, timing, payloads, and checks.

```powershell
npm run typecheck
npm run lint
npm test
npm run test:db
npx playwright install chromium
npm run test:e2e
npm run build
```

Unit tests cover customer validation, duplicate variants, money calculations, settings URL rules, product requirements, script-safe JSON-LD, and WhatsApp encoding. Database tests run the **unchanged migration SQL** in PGlite's PostgreSQL engine with minimal scaffolding for Supabase-owned auth/storage tables. They cover real RLS, admin CRUD, role isolation, catalog filtering, atomic enquiry creation, stale price/stock rejection, idempotency, rate limits, storage policies, and preserved snapshots.

Playwright checks the development preview on desktop and mobile: navigation, size availability, cart persistence, checkout, filters/empty states, protected routes, metadata endpoints, 404s, and 320 px overflow checks. Use a database without live credentials for these preview-specific tests.

PGlite storage-policy tests do not upload to Supabase's actual object service, and local RLS tests do not replace a live Auth integration test. Before launch, test owner login, image upload, all CRUD, cart updates after stock changes, and an actual enquiry with your own configured Supabase project. Confirm the resulting record is private, open the resulting WhatsApp URL, and confirm the message contents. No live external messages are sent by this repository's automated tests.

## Vercel deployment

1. Push this codebase to your private Git repository and import it in Vercel as a Next.js project.
2. Configure all required environment variables for the intended environment; set `NEXT_PUBLIC_SITE_URL` to your HTTPS domain and `ALLOW_DEMO_PREVIEW=false`.
3. Apply both database migrations and provision the owner before accepting enquiries.
4. Configure Supabase Auth's Site URL and allowed redirect URLs for your domain.
5. Deploy. `vercel.json` uses `npm ci` and `npm run build`.
6. Complete the live integration checks described above, supply real product photos and policies, and confirm contact links before launch.

No Vercel account, Supabase project credentials, real inventory, store contact information, or approved policies were provided with the brief. The application is implemented and locally verifiable; connecting and verifying those external services is the remaining launch dependency.

## Structure and future phases

`src/app/(home)` contains the homepage and its scroll intro. `src/app/(storefront)` contains the remaining public routes. `src/app/admin/(protected)` contains the protected owner routes. Components are grouped by intro/product/cart/checkout/admin/layout. `src/lib` contains shared types, validation, Supabase access, data queries, and WhatsApp formatting. `supabase/migrations` contains the database/security contract. `tests` contains unit, PostgreSQL, and browser coverage.

Phase 1 intentionally has no online payment, public customer accounts, scraped Instagram feed, wishlist, review system, delivery tracking, or automatic fulfilment. Product/variant IDs and enquiry snapshots allow these systems to be added later without trusting client state or losing historical details. Payment orders should use separate confirmed-order tables and reservation/fulfilment logic.

Generated editorial assets and their exact prompts are documented in `docs/IMAGE_ASSETS.md`. All are illustrative preview content; the logo is never generated or edited.
