import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { adminRouter } from "../modules/admin/admin.routes.js";
// import { claimRouter } from "../modules/claims/claim.routes.js";
// import { contractRouter } from "../modules/contracts/contract.routes.js";
// import { dashboardRouter } from "../modules/dashboard/dashboard.routes.js";
// import { dailyStatRouter } from "../modules/daily-stats/daily-stat.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { legacyAccessRouter } from "../modules/legacy-access/legacy-access.routes.js";
import { memoryVaultRouter } from "../modules/memory-vault/memory-vault.routes.js";
import { notificationRouter } from "../modules/notifications/notification.routes.js";
import { trustedContactRouter } from "../modules/trusted-contacts/trusted-contact.routes.js";
import { userRouter } from "../modules/users/user.routes.js";
import { sendSuccess } from "../utils/response.util.js";

export const apiRouter: ExpressRouter = Router();

apiRouter.get("/", (_req, res) => {
  sendSuccess(res, {
    message: "John Karle API v1",
    data: {
      health: "/api/v1/health",
    },
  });
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/trusted-contacts", trustedContactRouter);
apiRouter.use("/legacy-access", legacyAccessRouter);
apiRouter.use("/memory-vault", memoryVaultRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/users", userRouter);
// apiRouter.use("/claims", claimRouter);
// apiRouter.use("/contracts", contractRouter);
// apiRouter.use("/dashboard", dashboardRouter);
// apiRouter.use("/daily-stats", dailyStatRouter);
