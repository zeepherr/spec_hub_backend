import { OAuth2Client } from "google-auth-library";

import { config } from "../configs/index.js";

const googleClient = new OAuth2Client(config.google_client_id);

export const verifyGoogleCredential = async (credential) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: config.google_client_id,
  });

  const payload = ticket.getPayload();

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
