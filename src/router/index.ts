import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
// import { claimRouter } from "../modules/claims/claim.routes.js";
// import { contractRouter } from "../modules/contracts/contract.routes.js";
// import { dashboardRouter } from "../modules/dashboard/dashboard.routes.js";
// import { dailyStatRouter } from "../modules/daily-stats/daily-stat.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { memoryVaultRouter } from "../modules/memory-vault/memory-vault.routes.js";
// import { notificationRouter } from "../modules/notifications/notification.routes.js";
// import { userRouter } from "../modules/users/user.routes.js";

export const apiRouter: ExpressRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Nicholas Cook9 API v1",
    data: {
      health: "/api/v1/health",
    },
  });
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/memory-vault", memoryVaultRouter);
// apiRouter.use("/claims", claimRouter);
// apiRouter.use("/contracts", contractRouter);
// apiRouter.use("/dashboard", dashboardRouter);
// apiRouter.use("/daily-stats", dailyStatRouter);
// apiRouter.use("/notifications", notificationRouter);
// apiRouter.use("/users", userRouter);
