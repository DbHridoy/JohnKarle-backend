import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

type RequestSchema = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

export const validateRequest =
  (schema: RequestSchema): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }

    if (schema.params) {
      req.params = schema.params.parse(req.params) as Request["params"];
    }

    if (schema.query) {
      req.query = schema.query.parse(req.query) as Request["query"];
    }

    next();
  };
