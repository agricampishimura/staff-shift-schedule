import "dotenv/config";
import express from "express";
import cors from "cors";
import { facilitiesRouter } from "./routes/facilities.js";
import { staffRouter } from "./routes/staff.js";
import { requiredStaffingRouter } from "./routes/requiredStaffing.js";
import { shiftAssignmentsRouter } from "./routes/shiftAssignments.js";
import { workTimeCategoriesRouter } from "./routes/workTimeCategories.js";
import { daySchedulesRouter } from "./routes/daySchedules.js";
import { staffScheduleStatusRouter } from "./routes/staffScheduleStatus.js";
import { externalRouter } from "./routes/external.js";
import { apiKeyAuth } from "./middleware/apiKeyAuth.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// マスタ・シフト作成機能(このアプリ内でのみ使用)
app.use("/api/facilities", facilitiesRouter);
app.use("/api/staff", staffRouter);
app.use("/api/required-staffing", requiredStaffingRouter);
app.use("/api/shift-assignments", shiftAssignmentsRouter);
app.use("/api/work-time-categories", workTimeCategoriesRouter);
app.use("/api/day-schedules", daySchedulesRouter);
app.use("/api/staff-schedule-status", staffScheduleStatusRouter);

// 外部システム(AgriCamp等)向けAPI。x-api-keyヘッダによる認証が必須。
app.use("/api/external", apiKeyAuth, externalRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 3011;
app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
