// A typed HTTP error the central error handler knows how to serialize.
// Throw `new HttpError(404, "NOT_FOUND", "Project not found")` from any handler.
export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const NotFound = (message = "Not found") =>
  new HttpError(404, "NOT_FOUND", message);
export const BadRequest = (message = "Bad request") =>
  new HttpError(400, "BAD_REQUEST", message);
export const Unauthorized = (message = "Unauthorized") =>
  new HttpError(401, "UNAUTHORIZED", message);
// Login refused because the account was provisioned but never activated. Its own
// code (not the generic UNAUTHORIZED) so the client can tell it apart from bad
// credentials and show a translated, actionable message instead of "wrong
// password" — the message text here is a fallback, never shown to a user.
export const NotActivated = (message = "Account not activated") =>
  new HttpError(401, "ACCOUNT_NOT_ACTIVATED", message);
export const Forbidden = (message = "Forbidden") =>
  new HttpError(403, "FORBIDDEN", message);
export const Conflict = (message = "Conflict") =>
  new HttpError(409, "CONFLICT", message);
