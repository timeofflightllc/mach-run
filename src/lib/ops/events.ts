export type OpsAdminEvent = {
  id: string;
  at: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  action: string;
  note: string | null;
};

export function actionLabel(action: string): string {
  if (action === "set_package") return "Set package";
  if (action === "comp_time") return "Comp time";
  if (action === "cancel") return "Cancel";
  if (action === "delete_account") return "Delete account";
  if (action === "promo_save") return "Promo code";
  if (action === "promo_on") return "Promo on";
  if (action === "mail_send") return "Desk mail";
  return action;
}
