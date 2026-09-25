import "dotenv/config";

const getPositiveInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value ?? "", 10);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};
export const config = {
  port: process.env.PORT || "",
  database_url: process.env.DATABASE_URL || "",
  jwt_secret: process.env.JWT_SECRET || "",
  otp_secret: process.env.OTP_SECRET || "",
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
  tavily_api: process.env.TAVILY_API_KEY || "",
  gemini_model: process.env.GEMINI_MODEL || "",
  gemini_search_model: process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash",
  checkout_reservation_minutes: getPositiveInteger(
    process.env.CHECKOUT_RESERVATION_MINUTES,
    3,
  ),

  checkout_cleanup_interval_seconds: getPositiveInteger(
    process.env.CHECKOUT_CLEANUP_INTERVAL_SECONDS,
    30,
  ),
};

const REQUIRED_RUNTIME_CONFIG = [
  ["PORT", config.port],
  ["DATABASE_URL", config.database_url],
  ["CLIENT_URL", config.client_url],
  ["JWT_SECRET", config.jwt_secret],
  ["OTP_SECRET", config.otp_secret],
  ["MAIL_USER", config.mail_user],
  ["MAIL_APP_PASSWORD", config.mail_app_password],
];

export const validateRuntimeConfig = () => {
  const missing = REQUIRED_RUNTIME_CONFIG.filter(([, value]) => !value).map(
    ([name]) => name,
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  const quoted = REQUIRED_RUNTIME_CONFIG.filter(([, value]) =>
    /^(?:".*"|'.*')$/.test(value),
  ).map(([name]) => name);

  if (quoted.length > 0) {
    throw new Error(
      `${quoted.join(", ")} must not include surrounding quotes in the deployment environment.`,
    );
  }

  if (!/^\d+$/.test(config.port) || Number(config.port) <= 0) {
    throw new Error("PORT must be a positive integer.");
  }

  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(config.mail_user)) {
    throw new Error("MAIL_USER must be a plain email address.");
  }

  if (!/^[A-Z0-9]{16}$/i.test(config.mail_app_password)) {
    throw new Error(
      "MAIL_APP_PASSWORD must be a 16-character Google App Password without spaces.",
    );
  }

  if (config.node_env === "production") {
    const shortSecrets = [
      ["JWT_SECRET", config.jwt_secret],
      ["OTP_SECRET", config.otp_secret],
    ]
      .filter(([, value]) => value.length < 32)
      .map(([name]) => name);

    if (shortSecrets.length > 0) {
      throw new Error(
        `${shortSecrets.join(", ")} must be at least 32 characters in production.`,
      );
    }

    let databaseUrl;
    try {
      databaseUrl = new URL(config.database_url);
    } catch {
      throw new Error("DATABASE_URL must be a valid absolute URL.");
    }

    if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
      throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
    }

    let clientUrl;
    try {
      clientUrl = new URL(config.client_url);
    } catch {
      throw new Error("CLIENT_URL must be a valid absolute URL.");
    }

    if (clientUrl.protocol !== "https:") {
      throw new Error("CLIENT_URL must use HTTPS in production.");
    }
  }
};

export const corsOptions = {
  origin: config.client_url, // Allow only this domain (e.g., your React Vite dev server)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed custom headers
  optionsSuccessStatus: 200, // Legacy browser support
  credentials: true,
};
