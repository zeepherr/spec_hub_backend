import { OAuth2Client } from "google-auth-library";
import createHttpError from "http-errors";

import { config } from "../configs/index.js";
import { normalizeGoogleAuthError } from "../utils/provider-error.js";

const googleClient = new OAuth2Client(config.google_client_id);

export const verifyGoogleCredential = async (credential) => {
  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.google_client_id,
    });
  } catch (error) {
    throw normalizeGoogleAuthError(error);
  }

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    const error = createHttpError(401, "The Google credential is invalid.");

    error.code = "INVALID_GOOGLE_CREDENTIAL";

    throw error;
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    firstName: payload.given_name ?? null,
    lastName: payload.family_name ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
};
