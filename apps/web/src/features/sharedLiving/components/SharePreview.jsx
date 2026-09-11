import { useState } from "react";
import Button from "../../../shared/components/ui/Button";
import useT from "../../../shared/i18n/I18nProvider";
import api from "../api/sharedLivingApi";

export default function SharePreview({
  path,
  values,
  kind,
  members,
  currency,
}) {
  const { t } = useT();
  const [result, setResult] = useState(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const fingerprint = JSON.stringify(values);
  const preview = async () => {
    setBusy(true);
    setError(false);
    try {
      const included =
        values.included ||
        members
          .filter(
            (m) =>
              m.joined_on <= values.date &&
              (!m.left_on || m.left_on >= values.date),
          )
          .map((m) => m.id);
      const body = {
        ...values,
        kind,
        included,
        values: ["custom", "percentage", "weighted"].includes(values.method)
          ? Object.fromEntries(
              Object.entries(values.values || {}).filter(([id]) =>
                included.includes(id),
              ),
            )
          : undefined,
      };
      setResult({ fingerprint, shares: await api.save("post", path, body) });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 space-y-2">
      <Button variant="secondary" disabled={busy} onClick={preview}>
        {t("shared.preview")}
      </Button>
      {error && <p role="alert">{t("shared.invalid")}</p>}
      {result?.fingerprint === fingerprint &&
        result.shares.map((s) => (
          <p key={s.member_id}>
            {members.find((m) => m.id === s.member_id)?.name} · {currency}{" "}
            {Math.floor(s.amount_minor / 100)}.
            {String(s.amount_minor % 100).padStart(2, "0")}
          </p>
        ))}
    </div>
  );
}
