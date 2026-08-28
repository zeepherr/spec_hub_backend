import { resolveMx } from "node:dns/promises";
import nodeMailer from "nodemailer";
import { config } from "../configs/index.js";

export const hashVailMailDomain = async (email) => {
  const domain = email.split("@")[1];
  if (!domain) {
    return false;
  }
  try {
    const records = await resolveMx(domain);
    return (
      records.length > 0 &&
      records.some((record) => record.exchange && record.exchange !== ".")
    );
  } catch {
    return false;
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
