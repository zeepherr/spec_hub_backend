import "dotenv/config";

export const config = {
  port: process.env.PORT || "",
  database_url: process.env.DATABASE_URL || "",
  jwt_secret: process.env.JWT_SECRET || "",
  otp_secret: process.env.OPT_SECRET || "",
  mail_user: process.env.MAIL_USER || "",
  mail_app_password: process.env.MAIL_APP_PASSWORD || "",
  node_env: process.env.NODE_ENV || "development",
  r2_account_id: process.env.R2_ACCOUNT_ID || "",
  r2_access_key_id: process.env.R2_ACCESS_KEY_ID || "",
  r2_secret_access_key: process.env.R2_SECRET_ACCESS_KEY || "",
  r2_bucket_name: process.env.R2_BUCKET_NAME || "",
  r2_public_url: process.env.R2_PUBLIC_URL || "",
  google_client_id: process.env.GOOGLE_CLIENT_ID || "",
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET,
  stripe_secret_key: process.env.STRIPE_SECRET_KEY || "",
  stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || "",
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || "",
  client_url: process.env.CLIENT_URL || "http://localhost:5173",
  gemini_api: process.env.GEMINI_API_KEY || "",
  gemini_model: process.env.GEMINI_MODEL || "",
};

export const corsOptions = {
  origin: config.client_url, // Allow only this domain (e.g., your React Vite dev server)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed custom headers
  optionsSuccessStatus: 200, // Legacy browser support
  credentials: true,
};
