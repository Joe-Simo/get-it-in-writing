import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("check protected official sources", { hours: 1 }, internal.changes.scheduleDue);

export default crons;
