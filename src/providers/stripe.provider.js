import Stripe from "stripe";

import { config } from "../configs/index.js";
import { normalizeStripeError } from "../utils/provider-error.js";

const stripe = new Stripe(config.stripe_secret_key);

export const createStripeCheckoutSession = async ({ checkoutId, orders }) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

  try {
    return await stripe.checkout.sessions.create(
      {
        mode: "payment",

        line_items: orders.map((order) => ({
          price_data: {
            currency: "thb",

            product_data: {
              name: order.listing.title,
            },

            unit_amount: Math.round(Number(order.agreedPrice) * 100),
          },

          quantity: 1,
        })),

        metadata: {
          checkoutId: String(checkoutId),
        },

        client_reference_id: String(checkoutId),
        expires_at: expiresAt,

        success_url:
          `${config.client_url}/payment/success` +
          "?session_id={CHECKOUT_SESSION_ID}",

        cancel_url:
          `${config.client_url}/payment/cancel` + `?checkoutId=${checkoutId}`,
      },
      {
        /*
         * If Stripe creates the session but the network response
         * is lost, retrying will return the same session instead
         * of creating a duplicate.
         */
        idempotencyKey: `checkout-session:${checkoutId}`,
      },
    );
  } catch (error) {
    throw normalizeStripeError(error);
  }
};

export const getStripeCheckoutSession = async (sessionId) => {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    throw normalizeStripeError(error);
  }
};

export default stripe;
