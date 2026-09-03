import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { corsOptions } from "./configs/index.js";
import { stripeWebhook } from "./controllers/payment.controller.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { requestMdw } from "./middlewares/request.middlewares.js";
import aiRoute from "./routes/ai.route.js";
import authRoute from "./routes/auth.route.js";
import cartItemRoute from "./routes/cartItem.route.js";
import categoryRoute from "./routes/category.route.js";
import checkoutRoute from "./routes/checkout.route.js";
import listingRoute from "./routes/listing.route.js";
import orderRoute, { adminOrderRoute } from "./routes/order.route.js";
import paymentRoute from "./routes/payment.route.js";
import profileRouter from "./routes/user.route.js";

const app = express();
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(requestMdw);

app.use("/api/auth", authRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/ai", aiRoute);
app.use("/api/listings", listingRoute);
app.use("/api/user", profileRouter);
app.use("/api/cart", cartItemRoute);
app.use("/api/checkouts", checkoutRoute);
app.use("/api/orders", orderRoute);
app.use("/api/admin/orders", adminOrderRoute);
app.use("/api/payments", paymentRoute);
app.use(notFound);
app.use(errorHandler);
export default app;

// ACTIVE Listing
//       │
//       ├── Buy Now
//       │
//       └── Cart → Checkout
//                 │
//                 ↓
//        Backend validates listing
//                 ↓
//        ATOMIC RESERVATION
//        Listing ACTIVE → RESERVED
//                 +
//           Create Order
//                 ↓
//         AWAITING_PAYMENT
//                 ↓
//             Payment
//                 ↓
//               PAID
//                 ↓
//        Seller ships to Admin
//                 ↓
//         SELLER_SHIPPING
//                 ↓
//         Admin receives item
//                 ↓
//       INSPECTION_PENDING
//                 ↓
//            INSPECTING
//            /        \
//         PASS        FAIL
//          ↓            ↓
//       VERIFIED     REJECTED
//          ↓            ↓
//  Admin ships Buyer   Refund
//          ↓
//  SHIPPING_TO_BUYER
//          ↓
//  Buyer receives
//          ↓
//       COMPLETED
//          ↓
//  Payment RELEASED
//  Listing → SOLD

// npm install -g stripe
// stripe login
// stripe listen --forward-to localhost:5000/api/webhooks/stripe
// and copy the whse... add it in env
