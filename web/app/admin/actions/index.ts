// Barrel — re-exports every admin server action so existing imports
// `from "@/app/admin/actions"` continue to work without changes.

export type { ActionResult } from "./leads";
export {
  updateLeadStatusAction,
  addLeadNoteAction,
  convertLeadToClientAction,
  createBookingForLeadAction,
  createProposalForLeadAction,
  sendLeadEmailAction,
} from "./leads";

export { updateBookingStatusAction } from "./bookings";

export { updateProposalStatusAction } from "./proposals";

export {
  createContractFromProposalAction,
  sendContractAction,
  updateContractBodyAction,
  updateContractStatusAction,
} from "./contracts";

export {
  inviteToPortalAction,
  inviteStaffAction,
  revokeInvitationAction,
} from "./invitations";

export { updateStaffAccessAction } from "./staff";

export type { SmtpTestActionResult } from "./email";
export {
  sendBusinessEmailAction,
  testSmtpConnectionAction,
} from "./email";

export { updateSettingsAction } from "./settings";

export { addLibraryItemAction } from "./library";

export { uploadClientFileAction } from "./files";

export { createTaskAction, updateTaskAction } from "./tasks";

export { revokeSessionAction } from "./sessions";

export { updateSecuritySettingsAction, resetSecuritySettingsAction } from "./security";
