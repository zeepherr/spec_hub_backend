import { getUserBy } from "../services/auth.service.js";
import { verifyAccessToken } from "../utils/jwt.util.js";

const createSocketAuthError = (message, code) => {
  const error = new Error(message);

  error.data = {
    code,
  };

  return error;
};

export const authenticateSocket = async (socket, next) => {
  try {
    /*
     * Frontend must send the raw access token:
     *
     * auth: {
     *   token: accessToken
     * }
     *
     * Do not include "Bearer " here.
     */
    const token = socket.handshake.auth?.token;

    if (typeof token !== "string" || token.trim().length === 0) {
      return next(
        createSocketAuthError(
          "Authentication token is required.",
          "SOCKET_UNAUTHORIZED",
        ),
      );
    }

    const payload = await verifyAccessToken(token);

    if (!payload?.id) {
      return next(
        createSocketAuthError(
          "Invalid authentication token.",
          "SOCKET_UNAUTHORIZED",
        ),
      );
    }

    /*
     * Read the user from PostgreSQL.
     *
     * Do not trust the role from the JWT payload because
     * the user's role or active status may have changed.
     */
    const user = await getUserBy("id", payload.id);

    if (!user) {
      return next(
        createSocketAuthError(
          "User account was not found.",
          "SOCKET_UNAUTHORIZED",
        ),
      );
    }

    if (!user.isActive) {
      return next(
        createSocketAuthError("This account is inactive.", "ACCOUNT_INACTIVE"),
      );
    }

    /*
     * Store only the safe data needed by Socket handlers.
     */
    socket.data.user = {
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return next(
        createSocketAuthError(
          "Access token has expired.",
          "SOCKET_TOKEN_EXPIRED",
        ),
      );
    }

    return next(
      createSocketAuthError(
        "Invalid authentication token.",
        "SOCKET_UNAUTHORIZED",
      ),
    );
  }
};
