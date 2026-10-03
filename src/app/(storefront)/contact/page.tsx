import { Instagram } from "@/components/ui/instagram";
import { getStore } from "@/lib/data";
import { StoreDetails } from "@/components/layout/store-details";
import { ArrowUpRight } from "lucide-react";
export const metadata = {
  title: "Contact & visit",
  alternates: { canonical: "/contact" },
};
export default async function Contact() {
  const store = await getStore();
  return (
    <>
      <div className="page-heading">
        <div className="container">
          <p className="eyebrow">LET’S START A CONVERSATION</p>
          <h1>A personal touch.</h1>
          <p>
            For questions about a piece, help with your size, or a visit to our
            boutique — we’re here.
          </p>
        </div>
      </div>
      <StoreDetails store={store} />
      {store.instagram_url && (
        <div className="container" style={{ paddingBottom: 50 }}>
          <a
            className="button outline"
            href={store.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Instagram size={16} />
            Follow us on Instagram <ArrowUpRight size={15} />
          </a>
        </div>
      )}
    </>
  );
}
