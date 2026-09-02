import createHttpError from "http-errors";

import { createStripeCheckoutSession } from "../providers/stripe.provider.js";
import {
  createPayment,
  findOrderForPayment,
  findPaymentByOrderId,
  updatePaymentProviderRef,
} from "../services/payment.service.js";
import { createCheckoutSchema } from "../validations/payment.schema.js";

// Creates a Stripe Checkout Session for an existing unpaid order.
export const createCheckout = async (req, res, next) => {
  const { orderId } = createCheckoutSchema.parse(req.body);

  const buyerId = req.user.id;

  const order = await findOrderForPayment(orderId);

  if (!order) {
    return next(createHttpError(404, "Order not found."));
  }

  if (order.buyerId !== buyerId) {
    return next(
      createHttpError(403, "You are not allowed to pay for this order."),
    );
  }

  if (order.status !== "AWAITING_PAYMENT") {
    return next(createHttpError(409, "This order is not awaiting payment."));
  }

  let payment = await findPaymentByOrderId(order.id);

  if (payment && payment.status !== "PENDING") {
    return next(
      createHttpError(409, "This order already has a completed payment."),
    );
  }

  if (!payment) {
    payment = await createPayment({
      orderId: order.id,
      buyerId: order.buyerId,
      amount: order.agreedPrice,
    });
  }

  const session = await createStripeCheckoutSession({
    orderId: order.id,
    orderNumber: order.orderNumber,
    listingTitle: order.listing.title,
    amount: order.agreedPrice,
  });

  await updatePaymentProviderRef(payment.id, session.id);

  return res.status(200).json({
    message: "Checkout session created successfully",
    data: {
      orderId: order.id,
      paymentId: payment.id,
      sessionId: session.id,
      checkoutUrl: session.url,
    },
  });
};
