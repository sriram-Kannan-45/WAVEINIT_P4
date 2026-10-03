import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getStore } from "@/lib/data";
import { previewMode } from "@/lib/supabase/server";
import { whatsappUrl } from "@/lib/whatsapp";
import { MessageCircle } from "lucide-react";
export default async function Storefront({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await getStore();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header store={store} />
      <main id="main">{children}</main>
      {previewMode() && (
        <div className="preview-notice">
          DESIGN PREVIEW{" "}
          <span>
            Illustrative pieces & sample prices. Live ordering is disabled.
          </span>
        </div>
      )}
      <Footer store={store} />
      {store.whatsapp_number && (
        <a
          className="floating-whatsapp"
          href={whatsappUrl(
            store.whatsapp_number,
            "Hi Achu Designer Boutique, I would like to know more about your collections.",
          )!}
          aria-label="Chat with Achu on WhatsApp"
        >
          <MessageCircle size={24} />
        </a>
      )}
    </>
  );
}
