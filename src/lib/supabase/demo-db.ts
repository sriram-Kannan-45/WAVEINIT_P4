import { demoCategories, demoCollections, demoProducts } from "../demo";
import { defaultStore } from "../defaults";

type QueryResult<T> = {
  data: T;
  error: null;
  count: number;
};

type DemoBuilder = {
  select: () => DemoBuilder;
  eq: () => DemoBuilder;
  neq: () => DemoBuilder;
  gt: () => DemoBuilder;
  gte: () => DemoBuilder;
  lt: () => DemoBuilder;
  lte: () => DemoBuilder;
  ilike: () => DemoBuilder;
  like: () => DemoBuilder;
  in: () => DemoBuilder;
  order: () => DemoBuilder;
  limit: (n: number) => DemoBuilder;
  range: (from: number, to: number) => DemoBuilder;
  update: () => DemoBuilder;
  insert: () => DemoBuilder;
  upsert: () => DemoBuilder;
  delete: () => DemoBuilder;
  single: () => Promise<{ data: unknown; error: null }>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  then: <TResult1 = QueryResult<unknown>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<unknown>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
  catch: <TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) => Promise<QueryResult<unknown> | TResult>;
};

function createDemoQueryBuilder(data: unknown = []): DemoBuilder {
  const isArr = Array.isArray(data);
  const result: QueryResult<unknown> = {
    data,
    error: null,
    count: isArr ? (data as unknown[]).length : data ? 1 : 0,
  };

  const builder: DemoBuilder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    ilike: () => builder,
    like: () => builder,
    in: () => builder,
    order: () => builder,
    limit: (n: number) => {
      if (Array.isArray(data)) {
        return createDemoQueryBuilder(data.slice(0, n));
      }
      return builder;
    },
    range: (from: number, to: number) => {
      if (Array.isArray(data)) {
        return createDemoQueryBuilder(data.slice(from, to + 1));
      }
      return builder;
    },
    update: () => builder,
    insert: () => builder,
    upsert: () => builder,
    delete: () => builder,
    single: () =>
      Promise.resolve({
        data: Array.isArray(data)
          ? data[0] || { id: "1" }
          : data || { id: "1" },
        error: null,
      }),
    maybeSingle: () =>
      Promise.resolve({
        data: Array.isArray(data) ? data[0] || null : data || null,
        error: null,
      }),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
  };
  return builder;
}

export type DemoAdminDb = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: null }>;
  from: (table: string) => DemoBuilder;
  storage: {
    from: () => {
      upload: () => Promise<{ error: null }>;
    };
  };
  auth: {
    getUser: () => Promise<{
      data: { user: { email: string; id: string } };
      error: null;
    }>;
    signInWithPassword: () => Promise<{
      data: { user: { email: string } };
      error: null;
    }>;
    updateUser: () => Promise<{
      data: { user: { email: string } };
      error: null;
    }>;
    signOut: () => Promise<{ error: null }>;
  };
};

export function createDemoAdminDb(): DemoAdminDb {
  return {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      if (fn === "admin_dashboard") {
        return {
          data: {
            total_products: demoProducts.length,
            active_products: demoProducts.filter((p) => p.status === "active")
              .length,
            out_of_stock: 0,
            low_stock: 1,
            categories: demoCategories.length,
            collections: demoCollections.length,
            new_enquiries: 0,
            low_stock_products: [
              {
                id: demoProducts[0].id,
                name: demoProducts[0].name,
                total: 2,
              },
            ],
          },
          error: null,
        };
      }
      if (fn === "admin_product_list") {
        const query = String(args?.p_query || "").toLowerCase();
        const filtered = demoProducts.filter(
          (p) => !query || p.name.toLowerCase().includes(query),
        );
        return {
          data: {
            count: filtered.length,
            products: filtered.map((p) => ({
              ...p,
              categories: {
                name: p.categories?.name || "Kurtis & sets",
                slug: p.categories?.slug || "kurtis",
              },
              product_images: p.product_images,
              total_stock: p.product_variants.reduce(
                (acc, v) => acc + (v.active ? v.stock_quantity : 0),
                0,
              ),
            })),
          },
          error: null,
        };
      }
      if (fn === "save_product") {
        return { data: "demo-product-id", error: null };
      }
      return { data: null, error: null };
    },
    from: (table: string) => {
      if (table === "categories") {
        return createDemoQueryBuilder(demoCategories);
      }
      if (table === "collections") {
        return createDemoQueryBuilder(demoCollections);
      }
      if (table === "products") {
        return createDemoQueryBuilder(demoProducts.map((p) => ({ ...p })));
      }
      if (table === "product_variants") {
        const variants = demoProducts.flatMap((p) =>
          p.product_variants.map((v) => ({
            ...v,
            products: {
              id: p.id,
              name: p.name,
              status: p.status,
              product_images: p.product_images,
            },
          })),
        );
        return createDemoQueryBuilder(variants);
      }
      if (table === "store_settings") {
        return createDemoQueryBuilder(defaultStore);
      }
      if (table === "policies") {
        return createDemoQueryBuilder([
          {
            slug: "shipping-policy",
            title: "Shipping policy",
            content:
              "Orders ship across India via insured courier within 2-4 business days.",
          },
          {
            slug: "return-exchange",
            title: "Returns & exchange",
            content:
              "We accept exchanges within 7 days of delivery for unworn pieces with tags attached.",
          },
          {
            slug: "privacy-policy",
            title: "Privacy policy",
            content:
              "Your contact details and order details are kept strictly private.",
          },
          {
            slug: "terms",
            title: "Terms & conditions",
            content:
              "Welcome to Achu Designer Boutique. All designs and content are proprietary.",
          },
        ]);
      }
      if (table === "order_enquiries") {
        return createDemoQueryBuilder([]);
      }
      return createDemoQueryBuilder([]);
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    },
    auth: {
      getUser: async () => ({
        data: { user: { email: "achu@achuboutique.com", id: "achu-admin" } },
        error: null,
      }),
      signInWithPassword: async () => ({
        data: { user: { email: "achu@achuboutique.com" } },
        error: null,
      }),
      updateUser: async () => ({
        data: { user: { email: "achu@achuboutique.com" } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
  };
}
