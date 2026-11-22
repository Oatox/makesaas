import type { NextFunction, Request, Response } from "express";
import type { ZodType, ZodTypeDef } from "zod";
import { parseInput } from "./http";

/** Replaces req.body with its parsed value; invalid bodies get the shared 400 (see parseInput). */
export function validateBody<T>(schema: ZodType<T, ZodTypeDef, unknown>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = parseInput(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}
