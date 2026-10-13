import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
test("real PostgreSQL migrations, RLS, admin CRUD, and atomic enquiries", async (t) => {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  try {
    // Supabase-owned auth/storage scaffolding. Application SQL is executed unchanged.
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
  create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant all on storage.objects to anon,authenticated,service_role;`);
    await db.exec(
      await readFile("supabase/migrations/001_boutique.sql", "utf8"),
    );
    await db.exec(
      await readFile("supabase/migrations/002_admin_reporting.sql", "utf8"),
    );
    await db.exec(
      await readFile("supabase/migrations/003_subcategories.sql", "utf8"),
    );
    await db.exec(
      await readFile("supabase/migrations/004_inventory_and_new_arrivals.sql", "utf8"),
    );
    await db.exec(
      await readFile("supabase/migrations/005_admin_auth.sql", "utf8"),
    );
    await db.exec(
      `grant all on all tables in schema public to service_role;insert into auth.users values('${owner}'),('${other}');insert into public.admin_roles(user_id) values('${owner}');`,
    );
    async function as(role: string, user = "") {
      await db.exec(
        `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role ${role};`,
      );
    }
    await as("authenticated", owner);
    const category = (
      await db.query<{ id: string }>(
        "insert into categories(name,slug) values('Test kurtis','test-kurtis') returning id",
      )
    ).rows[0].id;
    const collection = (
      await db.query<{ id: string }>(
        "insert into collections(name,slug) values('Test festive edit','test-festive') returning id",
      )
    ).rows[0].id;
    const product = {
      name: "Test emerald kurti",
      slug: "test-emerald-kurti",
      category_id: category,
      short_description: "Test fixture",
      description: "Fixture only",
      fabric: "Cotton",
      colour: "Emerald",
      care_instructions: "Hand wash",
      sku: "TEST-1",
      keywords: "emerald cotton",
      original_price: 1699,
      selling_price: 1299,
      status: "active",
      is_featured: true,
      is_new_arrival: true,
      is_best_seller: false,
      meta_title: "",
      meta_description: "",
    };
    const variants = [
      { size: "S", stock_quantity: 4, active: true, sku: "" },
      { size: "M", stock_quantity: 0, active: true, sku: "" },
    ];
    const images = [
      {
        storage_path: "products/test.webp",
        alt_text: "Test photograph",
        sort_order: 0,
        is_cover: true,
      },
    ];
    const saved = await db.query<{ id: string }>(
      "select save_product(null,$1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb) id",
      [
        JSON.stringify(product),
        JSON.stringify(variants),
        JSON.stringify(images),
        JSON.stringify([collection]),
      ],
    );
    const pid = saved.rows[0].id;
    const variant = (
      await db.query<{ id: string }>(
        "select id from product_variants where product_id=$1 and size=$2",
        [pid, "S"],
      )
    ).rows[0].id;
    await t.test(
      "admin create/read/update retains variant IDs and collection links",
      async () => {
        await db.query(
          "select save_product($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)",
          [
            pid,
            JSON.stringify({ ...product, description: "Updated fixture" }),
            JSON.stringify(variants),
            JSON.stringify(images),
            JSON.stringify([collection]),
          ],
        );
        assert.equal(
          (
            await db.query<{ id: string }>(
              "select id from product_variants where product_id=$1 and size=$2",
              [pid, "S"],
            )
          ).rows[0].id,
          variant,
        );
        assert.equal(
          (
            await db.query(
              "select * from product_collections where product_id=$1",
              [pid],
            )
          ).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query<{ d: { total_products: number } }>(
              "select admin_dashboard() d",
            )
          ).rows[0].d.total_products,
          1,
        );
      },
    );
    await t.test(
      "category delete protects attached products and invalid stock rolls back",
      async () => {
        await assert.rejects(
          db.query("delete from categories where id=$1", [category]),
          /foreign key/,
        );
        await assert.rejects(
          db.query(
            "update product_variants set stock_quantity=-1 where id=$1",
            [variant],
          ),
          /check constraint/,
        );
        assert.equal(
          (
            await db.query<{ stock_quantity: number }>(
              "select stock_quantity from product_variants where id=$1",
              [variant],
            )
          ).rows[0].stock_quantity,
          4,
        );
      },
    );
    await t.test(
      "ordinary authenticated users cannot mutate or self-grant admin",
      async () => {
        await as("authenticated", other);
        assert.equal((await db.query("select * from products")).rows.length, 1);
        assert.equal(
          (await db.query("select * from order_enquiries")).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            "insert into categories(name,slug) values('Illegal','illegal')",
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.query("insert into admin_roles(user_id) values($1)", [other]),
          /permission denied/,
        );
        await assert.rejects(
          db.query(
            "select save_product(null,$1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb)",
            [
              JSON.stringify(product),
              JSON.stringify(variants),
              JSON.stringify(images),
              "[]",
            ],
          ),
          /Admin authorization required/,
        );
        await assert.rejects(
          db.query(
            "select create_enquiry('{}','[]',gen_random_uuid(),'hash','key')",
          ),
          /permission denied/,
        );
      },
    );
    await t.test(
      "public catalog applies combined filters and hides draft content",
      async () => {
        await as("authenticated", owner);
        await db.query(
          "insert into products(name,slug,category_id,selling_price,status) values('Draft piece','draft-piece',$1,1,'draft')",
          [category],
        );
        await as("anon");
        const result = (
          await db.query<{
            data: { products: { id: string }[]; count: number };
          }>(
            "select catalog_search(p_category=>'test-kurtis',p_collection=>'test-festive',p_size=>'S',p_availability=>'in-stock') data",
          )
        ).rows[0].data;
        assert.equal(result.count, 1);
        assert.equal(result.products[0].id, pid);
        assert.equal(
          (
            await db.query<{ data: { count: number } }>(
              "select catalog_search(p_category=>'test-kurtis',p_size=>'M',p_availability=>'in-stock') data",
            )
          ).rows[0].data.count,
          0,
        );
        assert.equal((await db.query("select * from products")).rows.length, 1);
        await assert.rejects(
          db.query("select * from order_enquiries"),
          /permission denied/,
        );
        await assert.rejects(
          db.query(
            "insert into storage.objects(bucket_id,name) values('boutique','products/illegal.webp')",
          ),
          /row-level security/,
        );
      },
    );
    const customer = {
      full_name: "Test customer",
      phone: "919876543210",
      alternate_phone: "",
      address_line_1: "12 Test Street",
      address_line_2: "",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      landmark: "",
      note: "Fixture only",
    };
    const lines = [
      {
        product_id: pid,
        variant_id: variant,
        quantity: 2,
        expected_price: 1299,
      },
    ];
    const key = "33333333-3333-4333-8333-333333333333";
    type Snapshot = {
      reference: string;
      subtotal: number;
      items: { name: string; quantity: number; price: number }[];
    };
    async function create(k = key, items = lines, hash = "fixture-hash") {
      return (
        await db.query<{ data: Snapshot }>(
          "select create_enquiry($1::jsonb,$2::jsonb,$3::uuid,$4,$5) data",
          [
            JSON.stringify(customer),
            JSON.stringify(items),
            k,
            hash,
            "fixture-rate",
          ],
        )
      ).rows[0].data;
    }
    let order: Snapshot;
    await t.test(
      "service-only checkout creates snapshots atomically without deducting stock",
      async () => {
        await as("service_role");
        await db.query(
          "update store_settings set whatsapp_number='919876543210' where id=1",
        );
        order = await create();
        assert.equal(order.subtotal, 2598);
        assert.match(order.reference, /^ACHU-\d{8}-[A-F0-9]{12}$/);
        assert.equal(order.items[0].price, 1299);
        assert.equal(
          (
            await db.query<{ stock_quantity: number }>(
              "select stock_quantity from product_variants where id=$1",
              [variant],
            )
          ).rows[0].stock_quantity,
          4,
        );
        assert.equal(
          (await db.query("select * from order_enquiry_items")).rows.length,
          1,
        );
      },
    );
    await t.test(
      "retry returns one reference and changed request hash is rejected",
      async () => {
        const repeat = await create();
        assert.equal(repeat.reference, order.reference);
        assert.equal(
          (await db.query("select * from order_enquiries")).rows.length,
          1,
        );
        await assert.rejects(
          create(key, lines, "different-hash"),
          /request changed/,
        );
      },
    );
    await t.test(
      "stale stock and client prices are rejected with no partial enquiry",
      async () => {
        await assert.rejects(
          create("44444444-4444-4444-8444-444444444444", [
            { ...lines[0], quantity: 5 },
          ]),
          /Stock has changed/,
        );
        await assert.rejects(
          create("55555555-5555-4555-8555-555555555555", [
            { ...lines[0], expected_price: 1 },
          ]),
          /Price has changed/,
        );
        await assert.rejects(
          create("66666666-6666-4666-8666-666666666666", [lines[0], lines[0]]),
          /Duplicate/,
        );
        assert.equal(
          (await db.query("select * from order_enquiries")).rows.length,
          1,
        );
      },
    );
    await t.test("rate limit is persistent and expires", async () => {
      assert.equal(
        (
          await db.query<{ ok: boolean }>(
            "select consume_rate_limit('limit-test',2,600) ok",
          )
        ).rows[0].ok,
        true,
      );
      assert.equal(
        (
          await db.query<{ ok: boolean }>(
            "select consume_rate_limit('limit-test',2,600) ok",
          )
        ).rows[0].ok,
        true,
      );
      assert.equal(
        (
          await db.query<{ ok: boolean }>(
            "select consume_rate_limit('limit-test',2,600) ok",
          )
        ).rows[0].ok,
        false,
      );
      await db.query(
        "update request_limits set window_start=now()-interval '20 minutes' where key='limit-test'",
      );
      assert.equal(
        (
          await db.query<{ ok: boolean }>(
            "select consume_rate_limit('limit-test',2,600) ok",
          )
        ).rows[0].ok,
        true,
      );
    });
    await t.test(
      "subcategories CRUD, cascading RLS, and catalog_search subcategory filter",
      async () => {
        await as("authenticated", owner);
        const sub = (
          await db.query<{ id: string }>(
            "insert into subcategories(category_id, name, slug, description, image, active, display_order) values($1, 'Test stone work', 'test-stone-work', 'Stone embellished', 'categories/stone.webp', true, 1) returning id",
            [category],
          )
        ).rows[0].id;
        assert.ok(sub);

        // Update product to attach subcategory
        const updatedProduct = { ...product, subcategory_id: sub };
        await db.query(
          "select save_product($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)",
          [
            pid,
            JSON.stringify(updatedProduct),
            JSON.stringify(variants),
            JSON.stringify(images),
            JSON.stringify([collection]),
          ],
        );

        // Public user search with subcategory filter
        await as("anon");
        const found = await db.query<{
          catalog_search: {
            count: number;
            products: Array<{
              name: string;
              subcategories: { name: string; slug: string };
            }>;
          };
        }>(
          "select catalog_search(p_subcategory := 'test-stone-work')",
        );
        const searchData = found.rows[0].catalog_search;
        assert.equal(searchData.count, 1);
        assert.equal(searchData.products[0].name, product.name);
        assert.equal(
          searchData.products[0].subcategories?.slug,
          "test-stone-work",
        );

        // Non-matching subcategory returns 0
        const notFound = await db.query<{
          catalog_search: { count: number };
        }>(
          "select catalog_search(p_subcategory := 'non-existent-sub')",
        );
        assert.equal(notFound.rows[0].catalog_search.count, 0);

        // Unauthorized user cannot insert subcategories
        await as("authenticated", other);
        await assert.rejects(
          db.query(
            "insert into subcategories(category_id, name, slug) values($1, 'Hacked', 'hacked')",
            [category],
          ),
        );
      },
    );
    await t.test(
      "snapshot privacy, settings updates, storage policy, and deletion history",
      async () => {
        await as("authenticated", other);
        assert.equal(
          (await db.query("select * from order_enquiries")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from order_enquiry_items")).rows.length,
          0,
        );
        await as("authenticated", owner);
        assert.equal(
          (await db.query("select * from order_enquiries")).rows.length,
          1,
        );
        await db.query(
          "update order_enquiries set status='contacted' where order_reference=$1",
          [order.reference],
        );
        await db.query(
          "update store_settings set opening_hours='Test hours' where id=1",
        );
        await db.query(
          "insert into storage.objects(bucket_id,name) values('boutique','products/test.webp')",
        );
        await db.query("delete from products where id=$1", [pid]);
        const snapshot = (
          await db.query<{
            product_id: string | null;
            product_name_snapshot: string;
          }>("select product_id,product_name_snapshot from order_enquiry_items")
        ).rows[0];
        assert.equal(snapshot.product_id, null);
        assert.equal(snapshot.product_name_snapshot, product.name);
        await as("anon");
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          1,
        );
        assert.equal(
          (
            await db.query<{ opening_hours: string }>(
              "select opening_hours from store_settings",
            )
          ).rows[0].opening_hours,
          "Test hours",
        );
      },
    );
    await t.test(
      "variant pricing, automatic stock notifications, atomic inventory lifecycle, and new arrivals CRUD",
      async () => {
        await as("authenticated", owner);
        const catRes = await db.query<{ id: string }>(
          "insert into categories(name,slug) values('Inventory test cat','inv-cat') returning id",
        );
        const catId = catRes.rows[0].id;

        // 1. Variant pricing via save_product
        const productPayload = {
          name: "Festive Anarkali",
          slug: "festive-anarkali-inv",
          category_id: catId,
          short_description: "Short desc",
          description: "Full desc",
          fabric: "Silk",
          colour: "Gold",
          care_instructions: "Dry clean",
          sku: "ANARKALI-01",
          keywords: "anarkali silk gold",
          selling_price: 2499,
          original_price: 2999,
          status: "active",
          is_featured: false,
          is_new_arrival: false,
          is_best_seller: false,
          meta_title: "",
          meta_description: "",
        };
        const variantsPayload = [
          { size: "S", stock_quantity: 10, active: true, price: 2499 },
          { size: "XL", stock_quantity: 2, active: true, price: 2799 },
        ];
        const imagesPayload = [
          { storage_path: "products/anarkali.jpg", alt_text: "Gold Anarkali", sort_order: 0, is_cover: true },
        ];
        const collectionsPayload: string[] = [];

        const prodRes = await db.query<{ save_product: string }>(
          "select save_product(null::uuid, $1::jsonb, $2::jsonb, $3::jsonb, $4::jsonb)",
          [
            JSON.stringify(productPayload),
            JSON.stringify(variantsPayload),
            JSON.stringify(imagesPayload),
            JSON.stringify(collectionsPayload),
          ],
        );
        const pId = prodRes.rows[0].save_product;

        // Verify variant price
        const vRows = (
          await db.query<{ size: string; stock_quantity: number; price: number }>(
            "select size, stock_quantity, price from product_variants where product_id = $1 order by size",
            [pId],
          )
        ).rows;
        assert.equal(vRows.length, 2);
        assert.equal(Number(vRows.find((v) => v.size === "XL")?.price), 2799);

        // 2. Automatic trigger notification on low stock
        const notifs = (
          await db.query<{ type: string; size: string; stock_quantity: number }>(
            "select type, size, stock_quantity from admin_notifications where product_id = $1",
            [pId],
          )
        ).rows;
        assert.equal(notifs.some((n) => n.type === "low_stock" && n.size === "XL"), true);

        // 3. Drop stock to 0 and verify out_of_stock notification trigger
        const xlVar = (
          await db.query<{ id: string }>(
            "select id from product_variants where product_id = $1 and size = 'XL'",
            [pId],
          )
        ).rows[0];
        await db.query("update product_variants set stock_quantity = 0 where id = $1", [xlVar.id]);

        const outNotifs = (
          await db.query<{ type: string; size: string; stock_quantity: number }>(
            "select type, size, stock_quantity from admin_notifications where product_id = $1 and type = 'out_of_stock'",
            [pId],
          )
        ).rows;
        assert.equal(outNotifs.length, 1);
        assert.equal(outNotifs[0].stock_quantity, 0);

        // 4. Atomic order lifecycle stock deduction & restoration
        const sVar = (
          await db.query<{ id: string }>(
            "select id from product_variants where product_id = $1 and size = 'S'",
            [pId],
          )
        ).rows[0];

        // Create enquiry
        const enqRes = await db.query<{ id: string }>(
          `insert into order_enquiries(order_reference, idempotency_key, request_hash, customer_name, phone, address, city, state, pincode, subtotal, status)
           values('ORD-TEST-001', gen_random_uuid(), 'hash-test-123', 'Ananya', '9876543210', '123 Boutique Rd', 'Chennai', 'Tamil Nadu', '600001', 2499, 'new')
           returning id`,
        );
        const enqId = enqRes.rows[0].id;
        await db.query(
          `insert into order_enquiry_items(order_enquiry_id, product_id, variant_id, product_name_snapshot, size_snapshot, quantity, unit_price_snapshot, subtotal_snapshot)
           values($1, $2, $3, 'Festive Anarkali', 'S', 2, 2499, 4998)`,
          [enqId, pId, sVar.id],
        );

        // Transition to confirmed: should deduct 2 units from size S (10 -> 8)
        await db.query("select admin_set_enquiry_status($1, 'confirmed')", [enqId]);

        const sAfterConfirm = (
          await db.query<{ stock_quantity: number }>(
            "select stock_quantity from product_variants where id = $1",
            [sVar.id],
          )
        ).rows[0].stock_quantity;
        assert.equal(sAfterConfirm, 8);

        // Idempotency: confirming again should NOT deduct twice
        await db.query("select admin_set_enquiry_status($1, 'confirmed')", [enqId]);
        const sAfterRetry = (
          await db.query<{ stock_quantity: number }>(
            "select stock_quantity from product_variants where id = $1",
            [sVar.id],
          )
        ).rows[0].stock_quantity;
        assert.equal(sAfterRetry, 8);

        // Transition to cancelled: should restore 2 units (8 -> 10)
        await db.query("select admin_set_enquiry_status($1, 'cancelled')", [enqId]);
        const sAfterCancel = (
          await db.query<{ stock_quantity: number }>(
            "select stock_quantity from product_variants where id = $1",
            [sVar.id],
          )
        ).rows[0].stock_quantity;
        assert.equal(sAfterCancel, 10);

        // 5. New arrivals CRUD: link product, check RLS, delete from new_arrivals without deleting product
        const naRes = await db.query<{ id: string }>(
          `insert into new_arrivals(product_id, display_order, badge_text, active)
           values($1, 1, 'JUST DROPPED', true) returning id`,
          [pId],
        );
        const naId = naRes.rows[0].id;

        // Anon can read active new arrivals
        await as("anon");
        const anonArrivals = (
          await db.query<{ id: string; badge_text: string }>(
            "select id, badge_text from new_arrivals where active = true",
          )
        ).rows;
        assert.equal(anonArrivals.length, 1);
        assert.equal(anonArrivals[0].badge_text, "JUST DROPPED");

        // Delete from new_arrivals as admin: product is preserved!
        await as("authenticated", owner);
        await db.query("delete from new_arrivals where id = $1", [naId]);
        const prodCheck = (
          await db.query<{ id: string }>("select id from products where id = $1", [pId])
        ).rows;
        assert.equal(prodCheck.length, 1);
      },
    );

    await t.test(
      "admin auth migration, RLS isolation, atomic rotation, and reuse detection",
      async () => {
        // 1. Service role inserts admin user
        await as("service_role");
        const adminRes = await db.query<{ id: string }>(
          `insert into admin_users(username, email, password_hash, role, is_active)
           values('achu_admin', 'owner@achuboutique.com', 'scrypt$16384$8$1$fake$hash', 'admin', true)
           returning id`,
        );
        const adminId = adminRes.rows[0].id;
        assert.ok(adminId);

        // 2. RLS & ACL Check: Anonymous cannot access admin_users or admin_refresh_tokens
        await as("anon");
        await assert.rejects(
          () => db.query("select * from admin_users"),
          /permission denied/i,
        );
        await assert.rejects(
          () => db.query("select * from admin_refresh_tokens"),
          /permission denied/i,
        );

        // 3. Service role creates initial refresh token
        await as("service_role");
        const hash1 = "token_hash_generation_1";
        const hash2 = "token_hash_generation_2";
        const hash3 = "token_hash_generation_3";
        const expires = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

        await db.query(
          `insert into admin_refresh_tokens(admin_id, token_hash, expires_at)
           values($1, $2, $3)`,
          [adminId, hash1, expires],
        );

        // 4. Atomic rotation from gen 1 to gen 2
        const rotRes = await db.query<{ ok: boolean; family_id: string }>(
          "select rotate_admin_refresh_token($1, $2, $3::timestamptz) as res",
          [hash1, hash2, expires],
        );
        const rotData = (rotRes.rows[0] as unknown as { res: { ok: boolean; family_id: string } }).res;
        assert.equal(rotData.ok, true);
        assert.ok(rotData.family_id);

        // Gen 1 token is now marked is_revoked = true
        const gen1 = (
          await db.query<{ is_revoked: boolean }>(
            "select is_revoked from admin_refresh_tokens where token_hash = $1",
            [hash1],
          )
        ).rows[0];
        assert.equal(gen1.is_revoked, true);

        // Gen 2 token is active
        const gen2 = (
          await db.query<{ is_revoked: boolean }>(
            "select is_revoked from admin_refresh_tokens where token_hash = $1",
            [hash2],
          )
        ).rows[0];
        assert.equal(gen2.is_revoked, false);

        // 5. Reuse detection attack: Attacker attempts to replay Gen 1 token!
        const attackRes = await db.query<{ res: { ok: boolean; error: string; family_id: string } }>(
          "select rotate_admin_refresh_token($1, $2, $3::timestamptz) as res",
          [hash1, hash3, expires],
        );
        const attackData = attackRes.rows[0].res;
        assert.equal(attackData.ok, false);
        assert.equal(attackData.error, "reuse_detected");

        // The entire family is now revoked!
        const familyTokens = (
          await db.query<{ is_revoked: boolean }>(
            "select is_revoked from admin_refresh_tokens where family_id = $1",
            [rotData.family_id],
          )
        ).rows;
        assert.ok(familyTokens.length >= 2);
        assert.ok(familyTokens.every((t) => t.is_revoked === true));
      },
    );
  } finally {
    await db.close();
  }
});
