import useT from "../../../shared/i18n/I18nProvider";
const FIELDS = {
  name: "name",
  description: "description",
  budget_minor: "budget",
  food_budget_minor: "food_budget",
  amount_minor: "amount",
  date: "date",
  due_date: "due_date",
  joined_on: "joined_on",
  left_on: "left_on",
  note: "note",
  reference: "reference",
  closed: "monthStatus",
  paid: "paymentStatus",
  method: "method",
  active: "memberStatus",
};
export default function AuditChanges({ before, after }) {
  const { t } = useT();
  const display = (key, value) => {
    if (value === undefined || value === null || value === "")
      return t("shared.emptyValue");
    if (key.endsWith("_minor")) {
      const n = BigInt(value);
      return `${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
    }
    if (key === "closed") return t(value ? "shared.closed" : "shared.open");
    if (key === "paid") return t(value ? "shared.paid" : "shared.unpaid");
    if (key === "active") return t(value ? "shared.active" : "shared.inactive");
    if (key === "method")
      return t(`shared.${value === "cash" ? "cash_method" : value}`);
    return String(value);
  };
  const changed = Object.keys(FIELDS).filter(
    (key) => before?.[key] !== after?.[key],
  );
  return (
    <details>
      <summary>{t("shared.changes")}</summary>
      <dl className="mt-2 space-y-2 text-sm">
        {changed.map((key) => (
          <div key={key}>
            <dt className="font-medium">{t(`shared.${FIELDS[key]}`)}</dt>
            <dd className="break-words">
              {t("shared.before")}: {display(key, before?.[key])} ·{" "}
              {t("shared.after")}: {display(key, after?.[key])}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
