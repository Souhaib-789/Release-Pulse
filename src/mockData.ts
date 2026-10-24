import type { Task } from "./types.ts";

function getIsoDateOffset(daysFromToday: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split("T")[0];
}

export function getMockTasks(): Task[] {
  return [
    {
      id: "CU-101",
      name: "Integrate payment gateway SDK",
      status: "In Progress",
      assignee: "Ali",
      due_date: getIsoDateOffset(2),
      release: "Release 2.4 - Payments Revamp",
    },
    {
      id: "CU-102",
      name: "Refund flow API",
      status: "In Progress",
      assignee: "Sara",
      due_date: getIsoDateOffset(3),
      release: "Release 2.4 - Payments Revamp",
    },
    {
      id: "CU-103",
      name: "Payment failure screens",
      status: "In Review",
      assignee: "Ahmed",
      due_date: getIsoDateOffset(1),
      release: "Release 2.4 - Payments Revamp",
    },
    {
      id: "CU-104",
      name: "Invoice PDF generation",
      status: "To Do",
      assignee: "Sara",
      due_date: getIsoDateOffset(5),
      release: "Release 2.4 - Payments Revamp",
    },
    {
      id: "CU-105",
      name: "Payments regression tests",
      status: "QA",
      assignee: "Hina",
      due_date: getIsoDateOffset(2),
      release: "Release 2.4 - Payments Revamp",
    },
    {
      id: "CU-201",
      name: "Signup form redesign",
      status: "In Progress",
      assignee: "Zoya",
      due_date: getIsoDateOffset(6),
      release: "Release 2.5 - Onboarding",
    },
    {
      id: "CU-202",
      name: "Email verification flow",
      status: "In Progress",
      assignee: "Ali",
      due_date: getIsoDateOffset(4),
      release: "Release 2.5 - Onboarding",
    },
    {
      id: "CU-203",
      name: "Welcome tour",
      status: "To Do",
      assignee: "Ahmed",
      due_date: getIsoDateOffset(8),
      release: "Release 2.5 - Onboarding",
    },
    {
      id: "CU-204",
      name: "Analytics events for onboarding",
      status: "Done",
      assignee: "Hina",
      due_date: getIsoDateOffset(-1),
      release: "Release 2.5 - Onboarding",
    },
    {
      id: "CU-205",
      name: "Referral code input",
      status: "In Review",
      assignee: "Zoya",
      due_date: getIsoDateOffset(3),
      release: "Release 2.5 - Onboarding",
    },
  ];
}

export const MOCK_STANDUP_NOTES = `Ali: Gateway SDK is basically done, just waiting on the sandbox keys from the vendor, been blocked on that since Tuesday. Email verification is going fine, should finish tomorrow.
Sara: Refund API is done and merged, I'm just waiting for QA to pick it up. Haven't started invoices yet, might slip because design hasn't given me the PDF template.
Ahmed: Failure screens are in review, no issues. Welcome tour is on hold until product confirms the copy.
Hina: Regression suite is running, found two flaky tests, nothing major. Analytics events shipped yesterday.
Zoya: Signup redesign is blocked on the new brand colors. Referral code input is ready for review.`;
