import Mailjet from "node-mailjet";
import { config } from "../configs/index.js";

const mailjet = new Mailjet({
  apiKey: config.mailjet_api_key,
  apiSecret: config.mailjet_secret_key,
  options: {
    timeout: 10_000,
  },
});

const addMailjetErrorDetails = (error) => {
  const safeError = new Error("Mailjet API request failed.");
  safeError.code = error.code ?? "MAILJET_API_ERROR";
  safeError.responseCode = error.statusCode;
  const responseBody = error.response?.body;
  if (responseBody) {
    safeError.response = JSON.stringify(responseBody);
  }

  return safeError;
};

export const verifyEmailTransport = async () => {
  try {
    await mailjet.get("myprofile", { version: "v3" }).request();
  } catch (error) {
    throw addMailjetErrorDetails(error);
  }
};

export const sendRegistrationOtp = async (email, otp) => {
  const minutes = 10;

  let result;
  try {
    result = await mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: config.mail_from_email,
            Name: config.mail_from_name,
          },
          To: [{ Email: email }],
          Subject: "Verify your email address",
          TextPart: [
            `Your verification code is ${otp}.`,
            "",
            `This code will expire in ${minutes} minutes.`,
            "",
            "If you did not request this registration, you can ignore this email.",
          ].join("\n"),
          HTMLPart: `
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
        },
      ],
    });
  } catch (error) {
    throw addMailjetErrorDetails(error);
  }

  const message = result.body?.Messages?.[0];
  const recipient = message?.To?.find(
    ({ Email }) => Email?.toLowerCase() === email.toLowerCase(),
  );

  if (message?.Status !== "success" || !recipient?.MessageID) {
    const error = new Error("Mailjet did not accept the recipient.");
    error.code = "EMAIL_RECIPIENT_REJECTED";
    error.responseCode = result.response?.status;
    error.response = JSON.stringify(message ?? result.body);
    throw error;
  }

  console.info("Registration email accepted by Mailjet", {
    messageId: recipient.MessageID,
    messageUuid: recipient.MessageUUID,
  });

  return {
    messageId: recipient.MessageID,
    messageUuid: recipient.MessageUUID,
  };
};
