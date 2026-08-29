import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

export const missionWorkflowManager = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: { maxAttempts: 3, initialBackoffMs: 500, base: 2 },
    retryActionsByDefault: true,
  },
});
