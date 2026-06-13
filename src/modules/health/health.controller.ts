import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/response.util.js";

export const getHealth = (_req: Request, res: Response) => {
  sendSuccess(res, {
    message: "Server is healthy",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
};
