import { config } from "../configs/index.js";

import {
  expireStripeCheckoutSession,
  getStripeCheckoutSession,
} from "../providers/stripe.provider.js";

import {
  expireUnpaidCheckout,
  findExpiredAwaitingPaymentCheckouts,
  findPaymentByCheckoutId,
} from "../services/payment.service.js";

let cleanupTimer = null;
let cleanupRunning = false;

const processExpiredCheckout = async (checkout) => {
  const payment = await findPaymentByCheckoutId(checkout.id);

  /*
   * Never expire a Checkout whose Payment
   * is already PAID or RELEASED.
   */
  if (payment && payment.status !== "PENDING") {
    console.warn(
      `Skipped Checkout ${checkout.id}: ` +
        `Payment status is ${payment.status}.`,
    );

    return;
  }

  if (payment?.providerRef) {
    const session = await getStripeCheckoutSession(payment.providerRef);

    /*
     * The Buyer may have completed payment while
     * the expiration job was starting.
     */
    if (session.status === "complete" || session.payment_status === "paid") {
      console.warn(
        `Skipped Checkout ${checkout.id}: ` +
          "Stripe Session is complete or paid.",
      );

      return;
    }

    if (session.status === "open") {
      const expiredSession = await expireStripeCheckoutSession(
        payment.providerRef,
      );

      if (expiredSession.status !== "expired") {
        return;
      }
    } else if (session.status !== "expired") {
      return;
    }
  }

  const expired = await expireUnpaidCheckout({
    checkoutId: checkout.id,
    paymentId: payment?.id ?? null,
  });

  if (expired) {
    console.log(
      `Expired Checkout ${checkout.id}; ` +
        "Orders cancelled and Listings released.",
    );
  }
};

export const cleanupExpiredCheckouts = async () => {
  if (cleanupRunning) {
    return;
  }

  cleanupRunning = true;

  try {
    const reservationDurationMs =
      config.checkout_reservation_minutes * 60 * 1000;

    const expirationCutoff = new Date(Date.now() - reservationDurationMs);

    const expiredCheckouts =
      await findExpiredAwaitingPaymentCheckouts(expirationCutoff);

    for (const checkout of expiredCheckouts) {
      try {
        await processExpiredCheckout(checkout);
      } catch (error) {
        /*
         * Leave this Checkout unchanged.
         * The next cleanup cycle can retry it.
         */
        console.error(`Failed to expire Checkout ${checkout.id}:`, error);
      }
    }
  } finally {
    cleanupRunning = false;
  }
};

export const startCheckoutExpirationJob = () => {
  if (cleanupTimer) {
    return;
  }

  const intervalMs = config.checkout_cleanup_interval_seconds * 1000;

  console.log(
    "Checkout expiration job started: " +
      `${config.checkout_reservation_minutes} minute reservation, ` +
      `${config.checkout_cleanup_interval_seconds} second interval.`,
  );

  /*
   * Clean existing abandoned Checkouts immediately
   * when the backend starts.
   */
  void cleanupExpiredCheckouts().catch((error) => {
    console.error("Initial Checkout cleanup failed:", error);
  });

  cleanupTimer = setInterval(() => {
    void cleanupExpiredCheckouts().catch((error) => {
      console.error("Checkout cleanup failed:", error);
    });
  }, intervalMs);

  /*
   * The timer itself should not prevent Node
   * from shutting down.
   */
  cleanupTimer.unref();
};

export const stopCheckoutExpirationJob = () => {
  if (!cleanupTimer) {
    return;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;

  console.log("Checkout expiration job stopped.");
};
