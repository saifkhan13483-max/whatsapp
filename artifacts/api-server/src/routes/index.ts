import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import contactsRouter from "./contacts.js";
import chatRouter from "./chat.js";
import chatsRouter from "./chats.js";
import notificationsRouter from "./notifications.js";
import reportsRouter from "./reports.js";
import subscriptionRouter from "./subscription.js";
import settingsRouter from "./settings.js";
import activityRouter from "./activity.js";
import alertsRouter from "./alerts.js";
import alertRulesRouter from "./alertRules.js";
import geofenceRouter from "./geofence.js";
import whatsappRouter from "./whatsapp.js";
import trackerRouter from "./tracker.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/contacts", contactsRouter);
router.use(chatRouter);
router.use("/chats", chatsRouter);
router.use("/notifications", notificationsRouter);
router.use("/reports", reportsRouter);
router.use("/subscription", subscriptionRouter);
router.use("/settings", settingsRouter);
router.use("/activity", activityRouter);
router.use("/alerts", alertsRouter);
router.use("/alert-rules", alertRulesRouter);
router.use("/geofence", geofenceRouter);
router.use("/whatsapp", whatsappRouter);
router.use("/tracker", trackerRouter);

export default router;
