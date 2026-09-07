import createHttpError from "http-errors";

export const toMinorUnits = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw createHttpError(500, "Invalid monetary amount.");
  }

  return Math.round(numericAmount * 100);
};

export const toBuyerRefundResponse = (refund) => {
  if (!refund) {
    return null;
  }

  return {
    id: refund.id,

    amount: Number(refund.amount),
    currency: refund.currency,
    status: refund.status,

    processedAt: refund.processedAt,
    failedAt: refund.failedAt,
  };
};

export const toAdminRefundResponse = (refund) => {
  if (!refund) {
    return null;
  }

  return {
    ...refund,

    amount: Number(refund.amount),
  };
};

export const toBuyerPaymentResponse = (payment) => {
  if (!payment) {
    return null;
  }

  return {
    status: payment.status,

    paidAt: payment.paidAt,

    refundedAmount:
      payment.refundedAmount == null ? 0 : Number(payment.refundedAmount),

    refundedAt: payment.refundedAt,
  };
};
