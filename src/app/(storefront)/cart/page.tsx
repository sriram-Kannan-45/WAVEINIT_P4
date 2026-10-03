import { Cart } from "@/components/cart/cart";
export const metadata = {
  title: "Your shopping bag",
  robots: { index: false, follow: false },
};
export default function CartPage() {
  return (
    <>
      <div className="page-heading">
        <div className="container">
          <p className="eyebrow">YOUR FAVOURITE FINDS</p>
          <h1>Your shopping bag.</h1>
        </div>
      </div>
      <div className="container">
        <Cart />
      </div>
    </>
  );
}
