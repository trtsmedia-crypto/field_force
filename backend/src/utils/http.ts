/** An error that carries an HTTP status. Anything else becomes a 500. */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }

  static badRequest(msg = 'Invalid request') {
    return new ApiError(400, msg, 'bad_request');
  }
  static unauthorized(msg = 'Sign in to continue') {
    return new ApiError(401, msg, 'unauthorized');
  }
  static forbidden(msg = 'You do not have access to this') {
    return new ApiError(403, msg, 'forbidden');
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg, 'not_found');
  }
  static conflict(msg = 'Already exists') {
    return new ApiError(409, msg, 'conflict');
  }
}

/** Wraps an async route so thrown errors reach the error middleware. */
export const asyncRoute =
  <T extends (...args: any[]) => Promise<any>>(fn: T) =>
  (req: any, res: any, next: any) =>
    fn(req, res, next).catch(next);
