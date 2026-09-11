import { useEffect, useState } from "react";
import api from "../../../shared/api/client";
import Button from "../../../shared/components/ui/Button";
import Input from "../../../shared/components/ui/Input";
import Modal from "../../../shared/components/ui/Modal";
import useT from "../../../shared/i18n/I18nProvider";

export default function ReceiptControls({ path, exists, writable, onSaved }) {
  const { t } = useT();
  const [url, setUrl] = useState(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png" || file.size > 524288) {
      setError(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await api.put(`/shared-living${path}`, await file.arrayBuffer(), {
        headers: { "Content-Type": "image/png" },
      });
      onSaved();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const view = async () => {
    setError(false);
    try {
      const res = await api.get(`/shared-living${path}`, {
        responseType: "blob",
      });
      setUrl(URL.createObjectURL(res.data));
    } catch {
      setError(true);
    }
  };
  return (
    <div className="mt-3 space-y-2">
      {exists && (
        <Button variant="secondary" onClick={view}>
          {t("shared.viewReceipt")}
        </Button>
      )}
      {writable && (
        <Input
          label={t("shared.receipt")}
          type="file"
          accept="image/png"
          disabled={busy}
          onChange={upload}
          hint={t("shared.receiptHint")}
        />
      )}
      {error && (
        <p role="alert" className="text-sm">
          {t("shared.receiptError")}
        </p>
      )}
      <Modal
        open={!!url}
        onClose={() => setUrl(null)}
        title={t("shared.viewReceipt")}
      >
        <img
          src={url || undefined}
          alt={t("shared.receipt")}
          className="h-auto max-w-full"
        />
      </Modal>
    </div>
  );
}
