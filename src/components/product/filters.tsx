"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/dialog";
import type { Taxonomy } from "@/types";
type Filters = Record<string, string | undefined>;
export function CatalogFilters({
  categories,
  collections,
  filters,
  mobile = false,
}: {
  categories: Taxonomy[];
  collections: Taxonomy[];
  filters: Filters;
  mobile?: boolean;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(filters.q || "");
  const initial = useRef(true);
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    if (q === (filters.q || "")) return;
    const timer = setTimeout(() => {
      const data = new FormData(form.current!);
      data.set("q", q);
      const params = new URLSearchParams();
      for (const [k, v] of data) if (String(v)) params.set(k, String(v));
      router.replace(`/shop?${params}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [q, router, filters.q]);
  const content = (
    <form ref={form} action="/shop" className="filter-form">
      <div className="filter-heading">
        <h2>FILTER BY</h2>
        <Link href="/shop">Clear all</Link>
      </div>
      {filters.new && <input type="hidden" name="new" value="true" />}
      {filters.best && <input type="hidden" name="best" value="true" />}
      {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
      <label>
        <span>Search the collection</span>
        <div className="catalog-search">
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What are you looking for?"
            maxLength={200}
          />
          <Search size={16} />
        </div>
      </label>
      <label>
        <span>Category</span>
        <select name="category" defaultValue={filters.category || ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Collection</span>
        <select name="collection" defaultValue={filters.collection || ""}>
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Size</span>
        <input
          name="size"
          defaultValue={filters.size || ""}
          list="sizes"
          placeholder="Any size"
          maxLength={40}
        />
        <datalist id="sizes">
          {["S", "M", "L", "XL", "XXL", "FREE SIZE"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </datalist>
      </label>
      <div>
        <label>Price range (₹)</label>
        <div className="price-inputs">
          <input
            aria-label="Minimum price"
            name="min"
            type="number"
            min="0"
            max="9999999"
            placeholder="Min"
            defaultValue={filters.min || ""}
          />
          <input
            aria-label="Maximum price"
            name="max"
            type="number"
            min="0"
            max="9999999"
            placeholder="Max"
            defaultValue={filters.max || ""}
          />
        </div>
      </div>
      <label>
        <span>Availability</span>
        <select name="availability" defaultValue={filters.availability || ""}>
          <option value="">All pieces</option>
          <option value="in-stock">In stock</option>
          <option value="out-of-stock">Out of stock</option>
        </select>
      </label>
      <button type="submit" className="button">
        Apply filters
      </button>
    </form>
  );
  return mobile ? (
    <Modal
      side
      title="Refine your collection"
      trigger={
        <button className="button outline">
          <SlidersHorizontal size={14} />
          Filter & search
        </button>
      }
    >
      {content}
    </Modal>
  ) : (
    content
  );
}
export function CatalogSort({
  value,
  filters,
}: {
  value: string;
  filters: Filters;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Sort products"
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v && k !== "page") p.set(k, v);
        });
        p.set("sort", e.target.value);
        router.push(`/shop?${p}`);
      }}
    >
      <option value="newest">Newest first</option>
      <option value="price-asc">Price: low to high</option>
      <option value="price-desc">Price: high to low</option>
      <option value="featured">Featured</option>
    </select>
  );
}
