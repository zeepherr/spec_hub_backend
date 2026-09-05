import createHttpError from "http-errors";

import { config } from "../configs/index.js";

import stripe, {
  createStripeCheckoutSession,
  getStripeCheckoutSession,
} from "../providers/stripe.provider.js";

import {
  cancelCheckoutOrders,
  createPayment,
  findCheckoutForPayment,
  findPaymentByCheckoutId,
  findPaymentByProviderRef,
  findPaymentStatusByProviderRef,
  markCheckoutExpired,
  markCheckoutOrdersPaid,
  markCheckoutPaid,
  markPaymentExpired,
  markPaymentPaid,
  releaseCheckoutListings,
  runPaymentTransaction,
  updatePaymentIntentRef,
  updatePaymentProviderRef,
} from "../services/payment.service.js";

import { toMinorUnits } from "../utils/order.helper.js";
import {
  createCheckoutPaymentSchema,
  paymentSessionSchema,
} from "../validations/payment.schema.js";

// Creates or reuses a Stripe Checkout Session.
export const createCheckout = async (req, res, next) => {
  const { checkoutId } = createCheckoutPaymentSchema.parse(req.body);

  const buyerId = req.user.id;

  const checkout = await findCheckoutForPayment(checkoutId);

  if (!checkout) {
    return next(createHttpError(404, "Checkout not found."));
  }

  if (checkout.buyerId !== buyerId) {
    return next(
      createHttpError(403, "You are not allowed to pay for this checkout."),
    );
  }

  if (checkout.status !== "AWAITING_PAYMENT") {
    return next(
      createHttpError(409, "This checkout is no longer awaiting payment."),
    );
  }

  const checkoutCreatedAt =
    checkout.createdAt == null ? NaN : new Date(checkout.createdAt).getTime();

  if (!Number.isFinite(checkoutCreatedAt)) {
    return next(createHttpError(500, "Invalid checkout creation time."));
  }

  const reservationDurationMs = config.checkout_reservation_minutes * 60 * 1000;
  const checkoutExpiresAt = checkoutCreatedAt + reservationDurationMs;

  if (Date.now() >= checkoutExpiresAt) {
    const error = createHttpError(
      409,
      "This checkout has expired. Please create a new checkout.",
    );

    error.code = "CHECKOUT_EXPIRED";

    return next(error);
  }

  if (checkout.orders.length === 0) {
    return next(
      createHttpError(409, "This checkout does not contain any orders."),
    );
  }

  const invalidOrder = checkout.orders.some(
    (order) => order.status !== "AWAITING_PAYMENT",
  );

  if (invalidOrder) {
    return next(
      createHttpError(
        409,
        "One or more orders are no longer awaiting payment.",
      ),
    );
  }

  const subtotalInMinorUnits = toMinorUnits(checkout.subtotal);

  const checkingFeeInMinorUnits = toMinorUnits(checkout.productCheckingFee);

  const deliveryFeeInMinorUnits = toMinorUnits(checkout.deliveryFee);

  const grandTotalInMinorUnits = toMinorUnits(checkout.grandTotal);

  const calculatedGrandTotal =
    subtotalInMinorUnits + checkingFeeInMinorUnits + deliveryFeeInMinorUnits;

  if (
    grandTotalInMinorUnits <= 0 ||
    grandTotalInMinorUnits !== calculatedGrandTotal
  ) {
    return next(
      createHttpError(409, "The Checkout pricing snapshot is invalid."),
    );
  }

  if (checkout.currency !== "THB") {
    return next(
      createHttpError(409, "The Checkout currency is not supported."),
    );
  }

  let payment = await findPaymentByCheckoutId(checkoutId);

  if (!payment) {
    payment = await createPayment({
      checkoutId,
      buyerId,

      // Payment must use the complete Checkout total.
      amount: checkout.grandTotal,

      status: "PENDING",
    });
  }

  if (payment.status !== "PENDING") {
    return next(createHttpError(409, "This payment is no longer pending."));
  }

  if (toMinorUnits(payment.amount) !== grandTotalInMinorUnits) {
    return next(
      createHttpError(
        409,
        "The Payment amount does not match the Checkout total.",
      ),
    );
  }

  // Reuse the Stripe Session if it is still open.
  if (payment.providerRef) {
    const existingSession = await getStripeCheckoutSession(payment.providerRef);

    if (existingSession.status === "open") {
      if (
        existingSession.amount_total !== grandTotalInMinorUnits ||
        existingSession.currency !== checkout.currency.toLowerCase()
      ) {
        return next(
          createHttpError(
            409,
            "The existing Stripe Session does not match the Checkout total.",
          ),
        );
      }

      return res.status(200).json({
        message: "Stripe checkout retrieved successfully",
        data: {
          checkoutId,
          paymentId: payment.id,
          amount: Number(checkout.grandTotal),
          currency: checkout.currency,
          sessionId: existingSession.id,
          checkoutUrl: existingSession.url,
        },
      });
    }

    if (existingSession.status === "expired") {
      return next(
        createHttpError(
          409,
          "This checkout has expired. Please create a new checkout.",
        ),
      );
    }

    if (existingSession.status === "complete") {
      return next(
        createHttpError(
          409,
          "This payment has already been completed or is being confirmed.",
        ),
      );
    }
  }

  const session = await createStripeCheckoutSession({
    checkoutId,
    orders: checkout.orders,
    paymentCreatedAt: payment.createdAt,
    productCheckingFee: checkout.productCheckingFee,
    grandTotal: checkout.grandTotal,
    deliveryFee: checkout.deliveryFee,
    currency: checkout.currency,
  });

  if (session.amount_total !== grandTotalInMinorUnits) {
    return next(
      createHttpError(
        500,
        "Stripe Session total does not match the Checkout total.",
      ),
    );
  }

  await updatePaymentProviderRef(payment.id, session.id);

  return res.status(200).json({
    message: "Stripe checkout created successfully",
    data: {
      checkoutId,
      paymentId: payment.id,
      amount: Number(checkout.grandTotal),
      currency: checkout.currency,
      sessionId: session.id,
      checkoutUrl: session.url,
    },
  });
};

// Handles Stripe webhook events.
export const stripeWebhook = async (req, res, next) => {
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      config.stripe_webhook_secret,
    );
  } catch {
    return next(createHttpError(400, "Invalid Stripe webhook signature."));
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status !== "paid") {
      return res.status(200).json({
        received: true,
      });
    }

    const payment = await findPaymentByProviderRef(session.id);

    if (!payment) {
      return next(createHttpError(404, "Payment not found."));
    }

    const checkoutId = Number(session.metadata?.checkoutId);

    if (!Number.isInteger(checkoutId) || checkoutId !== payment.checkoutId) {
      return next(createHttpError(400, "Invalid Stripe checkout metadata."));
    }

    /*
     * Stripe Checkout Session owns the PaymentIntent
     * used for the actual payment.
     *
     * Refunds will later target this pi_... reference,
     * not the cs_... Checkout Session ID.
     */
    const paymentIntentRef =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (
      typeof paymentIntentRef !== "string" ||
      !paymentIntentRef.startsWith("pi_")
    ) {
      return next(createHttpError(400, "Stripe PaymentIntent was not found."));
    }

    /*
     * A stored PaymentIntent must never silently
     * change to another Stripe PaymentIntent.
     */
    if (
      payment.paymentIntentRef &&
      payment.paymentIntentRef !== paymentIntentRef
    ) {
      return next(
        createHttpError(
          400,
          "Stripe PaymentIntent does not match the stored Payment.",
        ),
      );
    }

    const expectedPaymentAmount = toMinorUnits(payment.amount);

    const expectedCheckoutAmount = toMinorUnits(payment.checkout.grandTotal);

    if (expectedPaymentAmount !== expectedCheckoutAmount) {
      return next(
        createHttpError(
          400,
          "Payment amount does not match the Checkout total.",
        ),
      );
    }

    if (session.amount_total !== expectedCheckoutAmount) {
      return next(
        createHttpError(400, "Stripe payment amount does not match."),
      );
    }

    if (session.currency !== payment.checkout.currency.toLowerCase()) {
      return next(createHttpError(400, "Invalid Stripe payment currency."));
    }

    await runPaymentTransaction(async (tx) => {
      /*
       * Save pi_... first.
       *
       * This also runs safely when Stripe retries
       * the same webhook.
       */
      const paymentIntentUpdate = await updatePaymentIntentRef(
        payment.id,
        paymentIntentRef,
        tx,
      );

      if (paymentIntentUpdate.count !== 1) {
        throw createHttpError(
          409,
          "The Stripe PaymentIntent has already changed.",
        );
      }

      /*
       * Conditional update provides webhook
       * idempotency for Checkout state.
       */
      const checkoutUpdate = await markCheckoutPaid(payment.checkoutId, tx);

      /*
       * Stripe may deliver the same webhook more
       * than once.
       *
       * If this Checkout was already changed,
       * there is nothing else to repeat.
       */
      if (checkoutUpdate.count !== 1) {
        return;
      }

      const paymentUpdate = await markPaymentPaid(payment.id, new Date(), tx);

      if (paymentUpdate.count !== 1) {
        throw createHttpError(409, "The Payment status has already changed.");
      }

      const ordersUpdate = await markCheckoutOrdersPaid(payment.checkoutId, tx);

      if (ordersUpdate.count === 0) {
        throw createHttpError(409, "No Checkout Orders were updated as paid.");
      }
    });

    return res.status(200).json({
      received: true,
    });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;

    const payment = await findPaymentByProviderRef(session.id);

    if (!payment) {
      return res.status(200).json({
        received: true,
      });
    }

    await runPaymentTransaction(async (tx) => {
      const checkoutUpdate = await markCheckoutExpired(payment.checkoutId, tx);

      if (checkoutUpdate.count !== 1) {
        return;
      }

      await markPaymentExpired(payment.id, tx);

      await releaseCheckoutListings(payment.checkoutId, tx);

      await cancelCheckoutOrders(payment.checkoutId, tx);
    });

    return res.status(200).json({
      received: true,
    });
  }

  return res.status(200).json({
    received: true,
  });
};

export const getPaymentStatus = async (req, res, next) => {
  const { sessionId } = paymentSessionSchema.parse(req.params);

  const payment = await findPaymentStatusByProviderRef(sessionId);

  if (!payment) {
    return next(createHttpError(404, "Payment not found."));
  }

  if (payment.buyerId !== req.user.id) {
    return next(
      createHttpError(403, "You are not allowed to access this payment."),
    );
  }

  return res.status(200).json({
    success: true,
    data: {
      paymentId: payment.id,
      paymentStatus: payment.status,
      amount: payment.amount,
      paidAt: payment.paidAt,

      checkoutId: payment.checkout.id,
      checkoutStatus: payment.checkout.status,

      pricing: {
        currency: payment.checkout.currency,
        subtotal: payment.checkout.subtotal,

        productCheckingFee: payment.checkout.productCheckingFee,

        deliveryFee: payment.checkout.deliveryFee,

        grandTotal: payment.checkout.grandTotal,
      },

      orders: payment.checkout.orders,
    },
  });
};
