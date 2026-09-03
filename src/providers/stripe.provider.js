import Stripe from "stripe";

import { config } from "../configs/index.js";

const stripe = new Stripe(config.stripe_secret_key);

const toMinorUnits = (amount) => {
  return Math.round(Number(amount) * 100);
};

// Creates a Stripe-hosted Checkout Session.
export const createStripeCheckoutSession = async ({
  checkoutId,
  orders,
  productCheckingFee,
  deliveryFee,
  currency,
}) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

  const stripeCurrency = currency.toLowerCase();

  const productLineItems = orders.map((order) => ({
    price_data: {
      currency: stripeCurrency,

      product_data: {
        name: order.listing.title,
      },

      unit_amount: toMinorUnits(order.agreedPrice),
    },

    quantity: 1,
  }));

  const feeLineItems = [];

  const checkingAmount = toMinorUnits(productCheckingFee);

  if (checkingAmount > 0) {
    feeLineItems.push({
      price_data: {
        currency: stripeCurrency,

        product_data: {
          name: `Product checking service (${orders.length} item${orders.length > 1 ? "s" : ""})`,
        },

        unit_amount: checkingAmount,
      },

      quantity: 1,
    });
  }

  const deliveryAmount = toMinorUnits(deliveryFee);

  if (deliveryAmount > 0) {
    feeLineItems.push({
      price_data: {
        currency: stripeCurrency,

        product_data: {
          name: "Delivery fee",
        },

        unit_amount: deliveryAmount,
      },

      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",

    line_items: [...productLineItems, ...feeLineItems],

    metadata: {
      checkoutId: String(checkoutId),
    },

    client_reference_id: String(checkoutId),

    expires_at: expiresAt,

    success_url:
      `${config.client_url}` +
      "/payment/success" +
      "?session_id={CHECKOUT_SESSION_ID}",

    cancel_url:
      `${config.client_url}` + "/payment/cancel" + `?checkoutId=${checkoutId}`,
  });

  return session;
};

export const getStripeCheckoutSession = async (sessionId) => {
  return await stripe.checkout.sessions.retrieve(sessionId);
};

export default stripe;
