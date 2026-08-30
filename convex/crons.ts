import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "run due lead-form checks",
  { minutes: 30 },
  internal.journeyActions.runDue,
  {},
);

crons.interval(
  "reconcile lead-form confirmations",
  { minutes: 1 },
  internal.journeyActions.reconcileAgentMail,
  {},
);

crons.interval(
  "open incidents for overdue customer replies",
  { minutes: 5 },
  internal.journeys.expireDueEmailExpectations,
  {},
);

crons.interval(
  "retry lead-form alert delivery",
  { minutes: 5 },
  internal.alertActions.retryDue,
  {},
);

export default crons;
