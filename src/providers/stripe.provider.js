import createHttpError from "http-errors";
import Stripe from "stripe";

import { config } from "../configs/index.js";
import { normalizeStripeError } from "../utils/provider-error.js";

const stripe = new Stripe(config.stripe_secret_key);

const toMinorUnits = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw createHttpError(500, "Invalid payment amount.");
  }

  return Math.round(numericAmount * 100);
};

// Creates one Stripe Checkout Session containing
// products, checking service and delivery.
export const createStripeCheckoutSession = async ({
  checkoutId,
  orders,
  paymentCreatedAt,
  productCheckingFee,
  deliveryFee,
  grandTotal,
  currency,
}) => {
  const stripeCurrency = currency.toLowerCase();

  // Product line items
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

  // Fee line items
  const feeLineItems = [];

  if (Number(productCheckingFee) > 0) {
    feeLineItems.push({
      price_data: {
        currency: stripeCurrency,

        product_data: {
          name: "Product checking service",
        },

        /*
         * productCheckingFee is already the saved
         * total fee for the Checkout.
         */
        unit_amount: toMinorUnits(productCheckingFee),
      },

      quantity: 1,
    });
  }

  if (Number(deliveryFee) > 0) {
    feeLineItems.push({
      price_data: {
        currency: stripeCurrency,

        product_data: {
          name: "Delivery fee",
        },

        unit_amount: toMinorUnits(deliveryFee),
      },

      quantity: 1,
    });
  }

  const lineItems = [...productLineItems, ...feeLineItems];

  /*
   * Validate everything before contacting Stripe.
   */
  const lineItemsTotalInMinorUnits = lineItems.reduce((total, lineItem) => {
    return total + lineItem.price_data.unit_amount * lineItem.quantity;
  }, 0);

  const grandTotalInMinorUnits = toMinorUnits(grandTotal);

  if (lineItemsTotalInMinorUnits !== grandTotalInMinorUnits) {
    const error = createHttpError(
      500,
      "Stripe line items do not match the Checkout total.",
    );

    error.code = "STRIPE_LINE_ITEMS_TOTAL_MISMATCH";

    throw error;
  }

  const paymentCreatedAtMs =
    paymentCreatedAt == null ? NaN : new Date(paymentCreatedAt).getTime();

  if (!Number.isFinite(paymentCreatedAtMs)) {
    throw createHttpError(500, "Invalid payment creation time.");
  }

  const expiresAt = Math.floor(paymentCreatedAtMs / 1000) + 60 * 60;

  // Leave a small buffer above Stripe's 30-minute minimum.
  const minimumExpiresAt = Math.floor(Date.now() / 1000) + 30 * 60 + 5;

  if (expiresAt < minimumExpiresAt) {
    throw createHttpError(
      409,
      "This payment attempt is too old. Please create a new checkout.",
      { code: "PAYMENT_ATTEMPT_EXPIRED" },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",

        line_items: lineItems,

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
         * Repeating the same request returns
         * the same Stripe Session.
         */
        idempotencyKey: `checkout-session:${checkoutId}:${grandTotalInMinorUnits}`,
      },
    );

    return session;
  } catch (error) {
    throw normalizeStripeError(error);
  }
};

// Retrieves an existing Stripe Checkout Session.
export const getStripeCheckoutSession = async (sessionId) => {
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    throw normalizeStripeError(error);
  }
};

// Manually expires an open Stripe Checkout Session.
export const expireStripeCheckoutSession = async (sessionId) => {
  try {
    return await stripe.checkout.sessions.expire(sessionId);
  } catch (error) {
    throw normalizeStripeError(error);
  }
};

export default stripe;
