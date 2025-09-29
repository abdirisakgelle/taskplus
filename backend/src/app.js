import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { notFound, errorHandler } from "./middleware/error.js";
import { buildCrudRouter } from "./utils/crud.js";

// Models
import { Vod } from "./models/vod.js";

// Auth routes
import authRouter from "./routes/auth.routes.js";
import healthRouter from "./routes/health.js";

// Core management routes
import departmentsRouter from "./routes/departments.routes.js";
import sectionsRouter from "./routes/sections.routes.js";
import employeesRouter from "./routes/employees.routes.js";
import usersRouter from "./routes/users.routes.js";
import accessRouter from "./routes/access.routes.js";

// Advanced API routes
import tasksRouter from "./routes/tasks.routes.js";
import ticketsRouter from "./routes/tickets.routes.js";
import followUpsRouter from "./routes/follow-ups.routes.js";
import reviewsRouter from "./routes/reviews.routes.js";
import ideasRouter from "./routes/ideas.routes.js";
import contentRouter from "./routes/content.routes.js";
import productionRouter from "./routes/production.routes.js";
import socialMediaRouter from "./routes/social-media.routes.js";
import notificationsRouter from "./routes/notifications.routes.js";
import analyticsRouter from "./routes/analytics.routes.js";
import permissionsRouter from "./routes/permissions.routes.js";

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177'],
  credentials: true
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// Root route
app.get("/", (req, res) => res.json({ ok: true, service: "taskplus-backend" }));

// Health check endpoint with MongoDB status
app.use("/api/health", healthRouter);

// Auth
app.use("/api/auth", authRouter);

// Core management routes
app.use("/api/departments", departmentsRouter);
app.use("/api/sections", sectionsRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/users", usersRouter);
app.use("/api/access", accessRouter);

// Advanced API routes
app.use("/api/tasks", tasksRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/follow-ups", followUpsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/ideas", ideasRouter);
app.use("/api/content", contentRouter);
app.use("/api/production", productionRouter);
app.use("/api/social-media", socialMediaRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/permissions", permissionsRouter);

// Basic CRUD for remaining models
app.use("/api/vod", buildCrudRouter(Vod, "vod_id"));

// 404 and Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
