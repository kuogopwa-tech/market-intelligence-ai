import { logger } from "./logger.js";

/**
 * Retrieves the JWT secret from environment variables.
 * Fails fast in production if the secret is missing.
 * Allows a temporary fallback in development with a loud warning.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProduction) {
      const errorMsg = "CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production!";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    } else {
      logger.warn(
        "**************************************************\n" +
        "WARNING: JWT_SECRET is missing. Using insecure fallback secret for development.\n" +
        "DO NOT USE THIS IN PRODUCTION!\n" +
        "**************************************************"
      );
      return "dev_temporary_insecure_secret";
    }
  }

  return secret;
}

export const JWT_SECRET = getJwtSecret();
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
