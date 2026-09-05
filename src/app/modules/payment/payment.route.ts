import { Router } from "express";
import { OrgRole } from "../../../generated/prisma/enums";
import { authenticate, requireOrgMembership, requireRole } from "../../middleware/auth";
import { paymentLimiter } from "../../middleware/rateLimit";
import { validateRequest, validateRequestWith } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

router.post(
  "/initiate",
  authenticate,
  requireRole(OrgRole.ORG_OWNER),
  paymentLimiter,
  validateRequest(PaymentValidation.initiatePaymentSchema),
  PaymentController.initiate,
);

router.get(
  "/callback",
  validateRequestWith({ query: PaymentValidation.callbackQuerySchema }),
  PaymentController.callback,
);

router.post(
  "/execute",
  authenticate,
  paymentLimiter,
  validateRequest(PaymentValidation.executePaymentSchema),
  PaymentController.execute,
);

router.get("/:id", authenticate, PaymentController.getById);

const subscriptionRouter = Router({ mergeParams: true });

subscriptionRouter.get(
  "/:organizationId/subscription",
  authenticate,
  requireOrgMembership,
  PaymentController.getSubscription,
);

export const paymentRoutes = router;
export const subscriptionRoutes = subscriptionRouter;
