import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType, ZodTypeDef } from "zod";
import { fromZodError } from "zod-validation-error";

/** An error whose message is safe to show to the user (French), with its HTTP status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Parses request input, or throws a 400 with the same shape on every route. */
export function parseInput<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, "Paramètres invalides", fromZodError(result.error).message);
  return result.data;
}

/** Forwards async errors to the global error handler (Express 4 does not catch rejections). */
export function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
