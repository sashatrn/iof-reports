const RESULT_STATUS_LABELS: Record<string, string> = {
  OK: "OK",
  Finished: "Фінішував",
  MissingPunch: "Не всі КП",
  Disqualified: "Дискваліфіковано",
  disqualified: "Дискваліфіковано",
  DSQ: "Дискваліфіковано",
  DidNotFinish: "Не фінішував",
  DNF: "Не фінішував",
  Active: "На дистанції",
  Inactive: "Неактивний",
  OverTime: "Перевищено час",
  SportWithdrawal: "Знявся",
  NotCompeting: "Поза заліком",
  Moved: "Переведено",
  MovedUp: "Переведено вище",
  DidNotStart: "Не стартував",
  DNS: "Не стартував",
  DidNotEnter: "Не заявився",
  Cancelled: "Скасовано",
  Unknown: "Невідомо",
};

export function formatResultStatus(status: string | undefined): string {
  if (status === undefined || status === "") {
    return "";
  }

  return RESULT_STATUS_LABELS[status] ?? status;
}
