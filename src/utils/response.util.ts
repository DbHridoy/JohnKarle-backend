import type { Response } from "express";

type SuccessOptions<T> = {
  data?: T;
  message: string;
  statusCode?: number;
};

type PaginatedOptions<T> = {
  data: T[];
  message: string;
  meta: Record<string, unknown>;
  statusCode?: number;
};

export const sendSuccess = <T>(res: Response, options: SuccessOptions<T>) => {
  const { data, message, statusCode = 200 } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
  });
};

export const sendCreated = <T>(res: Response, options: Omit<SuccessOptions<T>, "statusCode">) =>
  sendSuccess(res, {
    ...options,
    statusCode: 201,
  });

export const sendPaginated = <T>(res: Response, options: PaginatedOptions<T>) => {
  const { data, message, meta, statusCode = 200 } = options;

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
};

export const sendMessage = (res: Response, message: string, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    message,
  });

export const sendNoContent = (res: Response) => res.status(204).end();
