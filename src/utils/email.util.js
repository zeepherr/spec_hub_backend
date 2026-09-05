import { resolveMx } from "node:dns/promises";
import nodeMailer from "nodemailer";
import { config } from "../configs/index.js";

const INVALID_DOMAIN_ERRORS = new Set(["ENOTFOUND", "ENODATA"]);

export const checkEmailDomain = async (email) => {
  const domain = email.split("@").at(-1)?.trim().toLowerCase();

  if (!domain) {
    return {
      status: "invalid",
      reason: "MISSING_DOMAIN",
    };
  }

  try {
    const records = await resolveMx(domain);

    const hasMailServer = records.some(
      (record) => record.exchange && record.exchange !== ".",
    );

    return {
      status: hasMailServer ? "valid" : "invalid",

      reason: hasMailServer ? null : "NO_MAIL_SERVER",
    };
  } catch (error) {
    /*
     * ENOTFOUND/ENODATA generally indicates that
     * the domain or its MX record does not exist.
     */
    if (INVALID_DOMAIN_ERRORS.has(error.code)) {
      return {
        status: "invalid",
        reason: "NO_MAIL_SERVER",
      };
    }

    /*
     * ETIMEOUT, ESERVFAIL, EREFUSED and other
     * infrastructure errors do not prove that
     * the email is invalid.
     */
    console.warn("Email domain lookup unavailable", {
      domain,
      code: error.code,
      message: error.message,
    });

    return {
      status: "unknown",
      reason: "DNS_UNAVAILABLE",
    };
  }
};

const transporter = nodeMailer.createTransport({
  service: "gmail",
  auth: {
    user: config.mail_user,
    pass: config.mail_app_password,
  },
});

export const sendRegistrationOtp = async (email, otp) => {
  const minutes = (10 * 60 * 1000) / (60 * 1000);
  return transporter.sendMail({
    from: `"SpecHUB" <${config.mail_user}>`,

    to: email,

    subject: "Verify your email address",

    text: [
      `Your verification code is ${otp}.`,
      "",
      `This code will expire in ${minutes} minutes.`,
      "",
      "If you did not request this registration, you can ignore this email.",
    ].join("\n"),

    html: `
      <h2>Email Verification</h2>

      <p>Your verification code is:</p>

      <h1>${otp}</h1>

      <p>
        This code will expire in
        <strong>${minutes} minutes</strong>.
      </p>

      <p>
        If you did not request this registration,
        you can ignore this email.
      </p>
    `,
  });
};
