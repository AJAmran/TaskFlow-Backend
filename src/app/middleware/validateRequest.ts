import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type ZodSchemaInput = ZodType;

export const validateRequest = (schema: ZodSchemaInput) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync(req.body ?? {});
      req.body = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateRequestWith = (schemas: {
  body?: ZodSchemaInput;
  query?: ZodSchemaInput;
  params?: ZodSchemaInput;
}) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body)
        req.body = await schemas.body.parseAsync(req.body ?? {});
      if (schemas.query)
        req.query = (await schemas.query.parseAsync(
          req.query,
        )) as typeof req.query;
      if (schemas.params)
        req.params = (await schemas.params.parseAsync(
          req.params,
        )) as typeof req.params;
      next();
    } catch (error) {
      next(error);
    }
  };
};
