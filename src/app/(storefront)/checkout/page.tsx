import { Checkout } from "@/components/checkout/checkout";
import { getStore } from "@/lib/data";
import { configured } from "@/lib/supabase/server";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};
export default async function CheckoutPage() {
  const store = await getStore();
  return (
    <>
      <div className="page-heading">
        <div className="container">
          <p className="eyebrow">ONE STEP CLOSER</p>
          <h1>Make it yours.</h1>
          <p>Choose your pieces. Confirm your order on WhatsApp.</p>
        </div>
      </div>
      <div className="container">
        <Checkout
          enabled={
            configured() &&
            Boolean(store.whatsapp_number) &&
            Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
          }
        />
      </div>
    </>
  );
}
