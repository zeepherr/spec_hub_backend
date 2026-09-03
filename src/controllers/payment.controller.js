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
  updatePaymentProviderRef,
} from "../services/payment.service.js";

import { createCheckoutPaymentSchema } from "../validations/payment.schema.js";

// Creates or reuses a Stripe Checkout Session for an existing checkout.
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

  const totalAmount = checkout.orders.reduce(
    (total, order) => total + Number(order.agreedPrice),
    0,
  );

  let payment = await findPaymentByCheckoutId(checkoutId);

  if (!payment) {
    payment = await createPayment({
      checkoutId,
      buyerId,
      amount: totalAmount,
      status: "PENDING",
    });
  }

  if (payment.status !== "PENDING") {
    return next(createHttpError(409, "This payment is no longer pending."));
  }

  // Reuse the existing Stripe Checkout Session if it is still open.
  if (payment.providerRef) {
    const existingSession = await getStripeCheckoutSession(payment.providerRef);

    if (existingSession.status === "open") {
      return res.status(200).json({
        message: "Stripe checkout retrieved successfully",
        data: {
          checkoutId,
          paymentId: payment.id,
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
  });

  await updatePaymentProviderRef(payment.id, session.id);

  return res.status(200).json({
    message: "Stripe checkout created successfully",
    data: {
      checkoutId,
      paymentId: payment.id,
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
  } catch (error) {
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

    if (checkoutId !== payment.checkoutId) {
      return next(createHttpError(400, "Invalid Stripe checkout metadata."));
    }

    const expectedAmount = Math.round(Number(payment.amount) * 100);

    if (session.amount_total !== expectedAmount) {
      return next(
        createHttpError(400, "Stripe payment amount does not match."),
      );
    }

    if (session.currency !== "thb") {
      return next(createHttpError(400, "Invalid Stripe payment currency."));
    }

    await runPaymentTransaction(async (tx) => {
      const checkoutUpdate = await markCheckoutPaid(payment.checkoutId, tx);

      if (checkoutUpdate.count !== 1) {
        return;
      }

      await markPaymentPaid(payment.id, new Date(), tx);

      await markCheckoutOrdersPaid(payment.checkoutId, tx);
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
      orders: payment.checkout.orders,
    },
  });
};
