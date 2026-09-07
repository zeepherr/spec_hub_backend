import { CHECKOUT_FEES } from "../configs/checkoutFee.config.js";
import { Prisma } from "../generated/prisma/client.js";

export const calculateCheckoutPricing = (
  listings,
  setupServiceRequested = false,
) => {
  const checkingFeePerItem = new Prisma.Decimal(
    CHECKOUT_FEES.PRODUCT_CHECKING_PER_ITEM,
  );

  const deliveryFee = new Prisma.Decimal(CHECKOUT_FEES.DELIVERY_PER_CHECKOUT);

  const setupServiceFee = setupServiceRequested
    ? new Prisma.Decimal(CHECKOUT_FEES.SETUP_SERVICE_PER_CHECKOUT)
    : new Prisma.Decimal(0);

  const subtotal = listings.reduce(
    (total, listing) => total.plus(listing.price),
    new Prisma.Decimal(0),
  );

  const productCheckingFee = checkingFeePerItem.mul(listings.length);

  const feeTotal = productCheckingFee.plus(deliveryFee).plus(setupServiceFee);

  const grandTotal = subtotal.plus(feeTotal);

  return {
    currency: CHECKOUT_FEES.CURRENCY,
    itemCount: listings.length,
    setupServiceRequested,

    subtotal,
    checkingFeePerItem,
    productCheckingFee,
    deliveryFee,
    setupServiceFee,
    feeTotal,
    grandTotal,
  };
};

const toNumber = (value) => Number(value.toFixed(2));

export const formatCheckoutPricing = (pricing) => {
  const feeLines = [
    {
      code: "PRODUCT_CHECKING",
      label: "Product checking service",
      unitAmount: toNumber(pricing.checkingFeePerItem),
      quantity: pricing.itemCount,
      amount: toNumber(pricing.productCheckingFee),
    },
    {
      code: "DELIVERY",
      label: "Delivery fee",
      unitAmount: toNumber(pricing.deliveryFee),
      quantity: 1,
      amount: toNumber(pricing.deliveryFee),
    },
  ];

  if (pricing.setupServiceRequested) {
    feeLines.push({
      code: "SETUP_SERVICE",
      label: "Setup service",
      unitAmount: toNumber(pricing.setupServiceFee),
      quantity: 1,
      amount: toNumber(pricing.setupServiceFee),
    });
  }

  return {
    currency: pricing.currency,
    itemCount: pricing.itemCount,
    setupServiceRequested: pricing.setupServiceRequested,
    subtotal: toNumber(pricing.subtotal),
    feeLines,
    feeTotal: toNumber(pricing.feeTotal),
    grandTotal: toNumber(pricing.grandTotal),
  };
};
