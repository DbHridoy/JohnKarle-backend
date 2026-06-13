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
    const validated: Express.ValidatedRequestData = {
      ...(req.validated ?? {}),
    };

    if (schema.body) {
      req.body = schema.body.parse(req.body);
      validated.body = req.body;
    }

    if (schema.params) {
      req.params = schema.params.parse(req.params) as Request["params"];
      validated.params = req.params;
    }

    if (schema.query) {
      validated.query = schema.query.parse(req.query);
    }

    req.validated = validated;

    next();
  };
