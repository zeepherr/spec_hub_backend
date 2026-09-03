import { CHECKOUT_FEES } from "../configs/checkoutFee.config.js";
import { Prisma } from "../generated/prisma/client.js";

export const calculateCheckoutPricing = (listings) => {
  const checkingFeePerItem = new Prisma.Decimal(
    CHECKOUT_FEES.PRODUCT_CHECKING_PER_ITEM,
  );

  const deliveryFee = new Prisma.Decimal(CHECKOUT_FEES.DELIVERY_PER_CHECKOUT);

  const subtotal = listings.reduce(
    (total, listing) => total.plus(listing.price),
    new Prisma.Decimal(0),
  );

  const productCheckingFee = checkingFeePerItem.mul(listings.length);

  const feeTotal = productCheckingFee.plus(deliveryFee);

  const grandTotal = subtotal.plus(feeTotal);

  return {
    currency: CHECKOUT_FEES.CURRENCY,
    itemCount: listings.length,
    subtotal,
    checkingFeePerItem,
    productCheckingFee,
    deliveryFee,
    feeTotal,
    grandTotal,
  };
};

const toNumber = (value) => Number(value.toFixed(2));

export const formatCheckoutPricing = (pricing) => {
  return {
    currency: pricing.currency,
    itemCount: pricing.itemCount,

    subtotal: toNumber(pricing.subtotal),

    feeLines: [
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
    ],

    feeTotal: toNumber(pricing.feeTotal),
    grandTotal: toNumber(pricing.grandTotal),
  };
};
