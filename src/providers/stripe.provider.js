import Stripe from "stripe";
import { config } from "../configs/index.js";
const stripe = new Stripe(config.stripe_secret_key);

// Creates a Stripe-hosted Checkout Session for one order.
export const createStripeCheckoutSession = async ({
  orderId,
  orderNumber,
  listingTitle,
  amount,
}) => {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",

    line_items: [
      {
        price_data: {
          currency: "thb",

          product_data: {
            name: listingTitle,
          },

          unit_amount: Math.round(Number(amount) * 100),
        },

        quantity: 1,
      },
    ],

    metadata: {
      orderId: String(orderId),
      orderNumber,
    },

    client_reference_id: String(orderId),

    success_url: `${config.client_url}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

    cancel_url: `${config.client_url}/payment/cancel?orderId=${orderId}`,
  });

  return session;
};

export default stripe;
