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
  } finally {
    await db.close();
  }
});
