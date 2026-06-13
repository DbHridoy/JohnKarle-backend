import type { AuthenticatedUser } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface ValidatedRequestData {
      body?: unknown;
      params?: unknown;
      query?: unknown;
    }

    interface Request {
      user?: AuthenticatedUser;
      validated?: ValidatedRequestData;
    }
  }
}

export {};
