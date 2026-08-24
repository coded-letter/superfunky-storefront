import { OrderSuccessShortcode } from "../components/wordpressShortcodes";

export function OrderSuccessDigitalMockupPage() {
  return (
    <div data-rendered-cms-shortcode="order-success">
      <OrderSuccessShortcode attributes={{ mode: "digital" }} />
    </div>
  );
}
