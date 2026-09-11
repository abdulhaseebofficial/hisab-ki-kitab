import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import Card from "../../../shared/components/ui/Card";
import Button from "../../../shared/components/ui/Button";
import Input from "../../../shared/components/ui/Input";
import Select from "../../../shared/components/ui/Select";
import Modal from "../../../shared/components/ui/Modal";
import PageHeader from "../../../shared/components/ui/PageHeader";
import useT from "../../../shared/i18n/I18nProvider";
import api from "../api/sharedLivingApi";
import AuditChanges from "../components/AuditChanges";
import ReceiptControls from "../components/ReceiptControls";
import SharePreview from "../components/SharePreview";
import LedgerForm from "../components/LedgerForm";

const today = () => new Date().toISOString().slice(0, 10);
const moneyField = (key = "amount") => ({
  key,
  type: "text",
  inputMode: "decimal",
  pattern: "(0|[1-9][0-9]{0,9})(\\.[0-9]{1,2})?",
  required: true,
});
const required = (key, type = "text") => ({
  key,
  type,
  required: true,
  maxLength: 100,
});
const minor = (value) => {
  const n = BigInt(value);
  return `${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
};
const remembered = (userId) => {
  try {
    return userId ? JSON.parse(localStorage.getItem(`shared-living:${userId}`) || '{}') : {};
  } catch { return {}; }
};
export default function SharedLivingPage({ userId }) {
  const { t, language } = useT();
  const [preference] = useState(() => remembered(userId));
  const pending = useRef(false);
  const submission = useRef(null);
  const [spaces, setSpaces] = useState([]),
    [spaceId, setSpaceId] = useState(preference?.spaceId || ""),
    [month, setMonth] = useState(/^(20\d\d|21\d\d|2200)-(0[1-9]|1[0-2])$/.test(preference?.month || '') ? preference.month : today().slice(0, 7));
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null),
    [invite, setInvite] = useState(null),
    [tab, setTab] = useState("overview"),
    [day, setDay] = useState(today());
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!userId || !spaces.some((s) => s.id === spaceId)) return;
    try { localStorage.setItem(`shared-living:${userId}`, JSON.stringify({ spaceId, month })); } catch { /* Storage is optional. */ }
  }, [userId, spaces, spaceId, month]);
  const reload = () => setVersion((n) => n + 1);
  useEffect(() => {
    let current = true;
    api
      .spaces()
      .then((rows) => {
        if (current) {
          setSpaces(rows);
          setSpaceId((id) =>
            rows.some((s) => s.id === id) ? id : rows[0]?.id || "",
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (current) {
          setError("shared.error");
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [version]);
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    if (!spaceId) return undefined;
    setLoading(true);
    api
      .month(spaceId, month)
      .then((result) => {
        if (current) setData(result);
      })
      .catch((err) => {
        if (current) setError(err.response?.data?.message || "shared.error");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [spaceId, month, version]);
  const selected = spaces.find((s) => s.id === spaceId),
    admin = selected?.role === "admin",
    writable = admin && data && !data.period.closed;
  const base = `/spaces/${spaceId}`,
    periodPath = `${base}/months/${month}`;
  const categoryLabel = useCallback(
    (id) => {
      const c = data?.categories.find((item) => item.id === id);
      return c?.name || t(`shared.categories.${c?.stable_key || "other"}`);
    },
    [data, t],
  );
  const format = (value) => `${selected?.currency || ""} ${value}`;
  const run = async (fn) => {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await fn();
      setDialog(null);
      reload();
      if (result && Object.hasOwn(result, 'code')) setInvite(result.code);
      if (result?.invite?.code) setInvite(result.invite.code);
      return result;
    } catch (err) {
      setError(err.response?.data?.message || "shared.error");
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const options = (keys) =>
    keys.map((key) => ({
      value: key,
      label: t(`shared.${key === "cash" ? "cash_method" : key}`),
    }));
  const memberOptions = [
    { value: "", label: t("shared.pool") },
    ...(data?.summary.members || []).map((m) => ({
      value: m.id,
      label: m.name,
    })),
  ];
  const openSpace = (edit = false) =>
    setDialog({
      kind: "space",
      title: edit ? "editSpace" : "createSpace",
      path: edit ? base : "/spaces",
      method: edit ? "patch" : "post",
      fields: [
        required("name"),
        {
          key: "currency",
          options: ["PKR", "BDT", "USD", "EUR", "GBP", "INR", "AED", "SAR"],
        },
        moneyField("budget"),
        moneyField("food_budget"),
        required("month", "month"),
        { key: "residents", type: "number", min: 1, max: 500, required: true },
        { key: "description" },
      ].filter(
        (f) => !edit || !["month", "budget", "food_budget"].includes(f.key),
      ),
      initial: edit
        ? selected
        : {
            currency: "PKR",
            month,
            budget: "0",
            food_budget: "0",
            residents: "1",
          },
    });
  const openMember = (row) =>
    setDialog({
      kind: "member",
      title: row ? "editMember" : "addMember",
      path: `${base}/members${row ? `/${row.id}` : ""}`,
      method: row ? "patch" : "post",
      fields: [
        required("name"),
        { key: "phone", maxLength: 30 },
        { key: "email", type: "email", maxLength: 254 },
        required("joined_on", "date"),
        { key: "left_on", type: "date" },
        moneyField("weight"),
        { key: "active", type: "checkbox" },
        { key: "note" },
      ],
      initial: row || { joined_on: `${month}-01`, weight: "1", active: true },
    });
  const openCategory = (row) =>
    setDialog({
      kind: "category",
      title: row ? "editCategory" : "addCategory",
      path: `${base}/categories${row ? `/${row.id}` : ""}`,
      method: row ? "patch" : "post",
      fields: [
        required("name"),
        { key: "kind", options: options(["food", "bill"]) },
        { key: "position", type: "number", min: 0, max: 10000, required: true },
        { key: "archived", type: "checkbox" },
      ],
      initial: row
        ? { ...row, name: row.name || categoryLabel(row.id) }
        : { kind: "food", position: 0 },
    });
  const openFinancial = (kind, row) => {
    const isPayment = kind === "payments",
      isBill = kind === "bills";
    const categories = (data?.categories || [])
      .filter((c) => !c.archived && c.kind === (isBill ? "bill" : "food"))
      .map((c) => ({ value: c.id, label: categoryLabel(c.id) }));
    const initial = row
      ? {
          ...row,
          amount: minor(row.amount_minor),
          included: data.shares
            .filter((s) => s.bill_id === row.id || s.expense_id === row.id)
            .map((s) => s.member_id),
          values: Object.fromEntries(
            data.shares
              .filter((s) => s.bill_id === row.id || s.expense_id === row.id)
              .map((s) => [s.member_id, minor(s.amount_minor)]),
          ),
          ...(!isPayment ? { method: "custom" } : {}),
        }
      : {
          date: day.slice(0, 7) === month ? day : `${month}-01`,
          due_date: day.slice(0, 7) === month ? day : `${month}-01`,
          method: isPayment ? "cash" : "equal",
          category_id: categories[0]?.value,
          member_id: data.summary.members[0]?.id,
          paid_by: "",
          paid: false,
        };
    setDialog({
      kind,
      title: row ? "editRecord" : `add_${kind}`,
      path: `${periodPath}/${kind}${row ? `/${row.id}` : ""}`,
      method: row ? "patch" : "post",
      initial,
      fields: [
        ...(isPayment
          ? [
              {
                key: "member_id",
                options: memberOptions.slice(1),
                required: true,
              },
            ]
          : [{ key: "category_id", options: categories, required: true }]),
        ...(isBill ? [required("name")] : []),
        moneyField(),
        required("date", "date"),
        ...(isBill
          ? [
              required("due_date", "date"),
              { key: "paid", type: "checkbox" },
              { key: "paid_by", options: memberOptions },
              { key: "recurring", type: "checkbox" },
            ]
          : []),
        {
          key: "method",
          options: options(
            isPayment
              ? ["cash", "bank", "mobile", "other"]
              : ["equal", "selected", "custom", "percentage", "weighted"],
          ),
        },
        ...(isPayment ? [{ key: "reference", maxLength: 100 }] : []),
        { key: "note" },
      ],
    });
  };
  const removeFinancial = (kind, row) =>
    setDialog({
      kind: "remove",
      title: "confirmDelete",
      path: `${periodPath}/${kind}/${row.id}`,
      method: "delete",
      fields: [],
      initial: {},
    });
  const submit = (values) =>
    run(async () => {
      const body = { ...values };
      if (dialog.kind === "space") body.residents = Number(body.residents);
      if (dialog.kind === "category") body.position = Number(body.position);
      if (["expenses", "bills"].includes(dialog.kind)) {
        if (!body.included)
          body.included = data.summary.members
            .filter(
              (m) =>
                m.joined_on <= body.date &&
                (!m.left_on || m.left_on >= body.date),
            )
            .map((m) => m.id);
        if (!["custom", "percentage", "weighted"].includes(body.method))
          delete body.values;
        else if (body.values)
          body.values = Object.fromEntries(
            Object.entries(body.values).filter(([id]) =>
              body.included.includes(id),
            ),
          );
      }
      if (dialog.kind === "join") {
        const joined = await api.join(body);
        setSpaceId(joined.space_id);
        return joined;
      }
      if (dialog.method === 'post' && ['expenses', 'bills', 'payments'].includes(dialog.kind)) {
        const fingerprint = JSON.stringify({ path: dialog.path, body });
        if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, id: crypto.randomUUID() };
        body.request_id = submission.current.id;
      }
      const result = await api.save(dialog.method, dialog.path, body);
      submission.current = null;
      if (dialog.kind === "space" && dialog.method === "post") {
        setSpaceId(result.id);
        setMonth(body.month);
      }
      return result;
    });
  const shift = (delta) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(d.toISOString().slice(0, 7));
  };
  const stats = [
    "budget",
    "foodBudget",
    "collected",
    "spent",
    "remainingBudget",
    "cash",
    "outstanding",
    "today",
    "averageDaily",
    "recommendedDaily",
    "remainingFoodBudget",
    "perPerson",
    "foodPerPerson",
    "billsPerPerson",
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("mode.shared_living")}
        subtitle={t("shared.subtitle")}
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openSpace()}>{t("shared.createSpace")}</Button>
          <Button
            variant="secondary"
            onClick={() =>
              setDialog({
                kind: "join",
                title: "join",
                initial: {},
                fields: [required("code")],
              })
            }
          >
            {t("shared.join")}
          </Button>
        </div>
      </PageHeader>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 p-3 text-sm"
        >
          {t(error.startsWith("shared.") ? error : "shared.error")}
        </p>
      )}
      {invite && (
        <Card>
          <p>{t("shared.codeOnce")}</p>
          <Input label={t("shared.code")} value={invite} readOnly />
          <Button variant="secondary" onClick={() => setInvite(null)}>
            {t("shared.dismiss")}
          </Button>
        </Card>
      )}
      {spaces.length > 0 && (
        <Card>
          <div className="grid items-end gap-3 sm:grid-cols-3">
            <Select
              label={t("shared.space")}
              disabled={busy}
              options={spaces.map((s) => ({ value: s.id, label: s.name }))}
              value={spaceId}
              onChange={(e) => {
                setInvite(null);
                setData(null);
                setSpaceId(e.target.value);
              }}
            />
            <Input
              type="month"
              disabled={busy}
              min="2000-01"
              max="2200-12"
              label={t("shared.month")}
              value={month}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value))
                  setMonth(e.target.value);
              }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy || month === '2000-01'} onClick={() => shift(-1)}>
                {t("shared.previous")}
              </Button>
              <Button variant="secondary" disabled={busy || month === '2200-12'} onClick={() => shift(1)}>
                {t("shared.next")}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm">
            {t(admin ? "shared.admin" : "shared.viewOnly")}
          </p>
        </Card>
      )}
      {loading && <p role="status">{t("shared.loading")}</p>}
      {!loading && !error && !spaces.length && <Card>{t("shared.emptySpaces")}</Card>}
      {admin && spaceId && !data && !loading && error === "shared.noMonth" && (
        <Button
          onClick={() =>
            setDialog({
              kind: "period",
              title: "startMonth",
              path: periodPath,
              method: "put",
              fields: [moneyField("budget"), moneyField("food_budget")],
              initial: { budget: "0", food_budget: "0" },
            })
          }
        >
          {t("shared.startMonth")}
        </Button>
      )}
      {data && (
        <>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label={t("shared.sections")}
          >
            {[
              "overview",
              "daily",
              "bills",
              "members",
              "payments",
              "manage",
              "activity",
            ].map((key) => (
              <Button
                key={key}
                role="tab"
                id={`shared-tab-${key}`}
                aria-controls="shared-panel"
                tabIndex={tab === key ? 0 : -1}
                onKeyDown={(event) => {
                  const tabs = [...event.currentTarget.parentElement.querySelectorAll('[role="tab"]')];
                  const index = tabs.indexOf(event.currentTarget);
                  const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
                  if (next !== null) { event.preventDefault(); tabs[next].focus(); tabs[next].click(); }
                }}
                aria-selected={tab === key}
                variant={tab === key ? "primary" : "secondary"}
                onClick={() => setTab(key)}
              >
                {t(`shared.${key}`)}
              </Button>
            ))}
          </div>
          <div id="shared-panel" role="tabpanel" aria-labelledby={`shared-tab-${tab}`} className="space-y-5 min-w-0 break-words">
          {data.period.closed && (
            <p className="text-sm">{t("shared.closed")}</p>
          )}
          {tab === "overview" && (
            <>
              <Card>
                <p>
                  {t("shared.activeMembers")}: {data.summary.activeMembers}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {t("shared.cashExplanation")}
                </p>
              </Card>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((key) => (
                  <Card key={key}>
                    <p className="text-sm text-slate-500">
                      {t(`shared.${key}`)}
                    </p>
                    <p className="mt-2 break-words text-xl font-semibold">
                      {format(data.summary[key])}
                    </p>
                  </Card>
                ))}
              </div>
              <Card>
                <h2 className="mb-4 font-semibold">{t("shared.dailyChart")}</h2>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.summary.daily}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => value.slice(8)}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [
                          format(value),
                          t("shared.amount"),
                        ]}
                      />
                      <Bar
                        dataKey="amount"
                        name={t("shared.amount")}
                        fill="#2f7d4f"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p>
                  {t("shared.highestDay")}: {data.summary.highestDay.date} ·{" "}
                  {format(data.summary.highestDay.amount)}
                </p>
              </Card>
              <Card>
                <h2 className="font-semibold">
                  {t("shared.categoryBreakdown")}
                </h2>
                {data.summary.categories.map((c) => (
                  <p
                    className="mt-2 flex justify-between gap-3"
                    key={c.category_id}
                  >
                    <span>{categoryLabel(c.category_id)}</span>
                    <span>{format(c.amount)}</span>
                  </p>
                ))}
              </Card>
              <Card>
                <h2 className="font-semibold">{t("shared.recentExpenses")}</h2>
                {data.expenses
                  .slice(-5)
                  .reverse()
                  .map((e) => (
                    <p className="mt-2" key={e.id}>
                      {e.date} · {categoryLabel(e.category_id)} ·{" "}
                      {format(minor(e.amount_minor))}
                    </p>
                  ))}
              </Card>
              <Card>
                <h2 className="font-semibold">{t("shared.unpaidBills")}</h2>
                {data.bills
                  .filter((b) => !b.paid)
                  .map((b) => (
                    <p className="mt-2" key={b.id}>
                      {b.name} · {b.due_date} · {format(minor(b.amount_minor))}
                    </p>
                  ))}
              </Card>
              <Card>
                <h2 className="font-semibold">{t("shared.comparisons")}</h2>
                {data.periods.map((p) => (
                  <p className="mt-2" key={p.id}>
                    {p.month_key} · {t("shared.food")}:{" "}
                    {format(minor(p.food_minor))} · {t("shared.bills")}:{" "}
                    {format(minor(p.bills_minor))}
                  </p>
                ))}
              </Card>
            </>
          )}
          {tab === "daily" && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  type="date"
                  label={t("shared.date")}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
                {writable && (
                  <Button onClick={() => openFinancial("expenses")}>
                    {t("shared.add_expenses")}
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.summary.daily.map((d) => (
                  <Card key={d.date}>
                    <button
                      className="w-full text-left font-semibold"
                      onClick={() => setDay(d.date)}
                    >
                      {d.date} · {format(d.amount)}
                    </button>
                    {d.date === day &&
                      data.expenses
                        .filter((e) => e.date === d.date)
                        .map((e) => (
                          <div key={e.id} className="mt-3 space-y-2">
                            <p>
                              {categoryLabel(e.category_id)} ·{" "}
                              {format(minor(e.amount_minor))}
                            </p>
                            <p className="text-sm">{e.note}</p>
                            {writable && (
                              <div className="flex gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => openFinancial("expenses", e)}
                                >
                                  {t("shared.edit")}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => removeFinancial("expenses", e)}
                                >
                                  {t("shared.remove")}
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                  </Card>
                ))}
              </div>
            </>
          )}
          {["bills", "payments"].includes(tab) && (
            <>
              {writable && (
                <Button onClick={() => openFinancial(tab)}>
                  {t(`shared.add_${tab}`)}
                </Button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {data[tab].map((row) => (
                  <Card key={row.id}>
                    <h2 className="font-semibold">
                      {tab === "bills"
                        ? row.name
                        : data.summary.members.find(
                            (m) => m.id === row.member_id,
                          )?.name}
                    </h2>
                    <p>
                      {row.date} · {format(minor(row.amount_minor))}
                    </p>
                    <p className="text-sm">{row.note}</p>
                    {tab === "bills" && (
                      <>
                        <p>
                          {t(row.paid ? "shared.paid" : "shared.unpaid")} ·{" "}
                          {t("shared.due_date")}: {row.due_date}
                        </p>
                        {data.shares
                          .filter((s) => s.bill_id === row.id)
                          .map((s) => (
                            <p className="mt-1 text-sm" key={s.id}>
                              {
                                data.summary.members.find(
                                  (m) => m.id === s.member_id,
                                )?.name
                              }
                              : {format(minor(s.amount_minor))}{" "}
                              {s.manually_adjusted && t("shared.adjusted")}
                            </p>
                          ))}
                      </>
                    )}
                    {tab === "bills" && (
                      <ReceiptControls
                        path={`${periodPath}/bills/${row.id}/receipt`}
                        exists={row.has_receipt}
                        writable={writable}
                        onSaved={reload}
                      />
                    )}{" "}
                    {tab === "payments" && (
                      <p>
                        {t(
                          `shared.${row.method === "cash" ? "cash_method" : row.method}`,
                        )}{" "}
                        · {row.reference}
                      </p>
                    )}
                    {writable && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => openFinancial(tab, row)}
                        >
                          {t("shared.edit")}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => removeFinancial(tab, row)}
                        >
                          {t("shared.remove")}
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
              {!data[tab].length && <Card>{t("shared.empty")}</Card>}
            </>
          )}
          {tab === "members" && (
            <>
              {admin && (
                <Button onClick={() => openMember()}>
                  {t("shared.addMember")}
                </Button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {data.summary.members.map((m) => (
                  <Card key={m.id}>
                    <h2 className="font-semibold">
                      {m.name} ·{" "}
                      {t(
                        m.active && !m.archived
                          ? "shared.active"
                          : "shared.inactive",
                      )}
                    </h2>
                    <p className="text-sm">
                      {m.joined_on} – {m.left_on || t("shared.present")}
                    </p>
                    {[
                      "contributed",
                      "paidDirect",
                      "assigned",
                      "balance",
                      "due",
                      "credit",
                      "foodCost",
                      "billsCost",
                    ].map((key) => (
                      <p className="mt-1 flex justify-between gap-3" key={key}>
                        <span>{t(`shared.${key}`)}</span>
                        <span>{format(m[key])}</span>
                      </p>
                    ))}
                    <p className="mt-2 font-semibold">
                      {t(`shared.${m.status}`)}
                    </p>
                    <details className="mt-3">
                      <summary>{t("shared.paymentHistory")}</summary>
                      {data.payments
                        .filter((p) => p.member_id === m.id)
                        .map((p) => (
                          <p key={p.id}>
                            {p.date} · {format(minor(p.amount_minor))} ·{" "}
                            {t(
                              `shared.${p.method === "cash" ? "cash_method" : p.method}`,
                            )}
                          </p>
                        ))}
                    </details>
                    {admin && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => openMember(m)}
                        >
                          {t("shared.edit")}
                        </Button>
                        {!m.archived && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setDialog({
                                kind: "removeMember",
                                title: "removeMember",
                                path: `${base}/members/${m.id}`,
                                method: "delete",
                                fields: [required("left_on", "date")],
                                initial: { left_on: today() },
                              })
                            }
                          >
                            {t("shared.remove")}
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
          {tab === "manage" && (
            <>
              <Card>
                <h2 className="font-semibold">{t("shared.spaceDetails")}</h2>
                <p>
                  {selected.name} · {selected.currency} · {selected.residents}
                </p>
                <p>{selected.description}</p>
                {admin && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => openSpace(true)}>
                      {t("shared.editSpace")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        setDialog({
                          kind: "invite",
                          title: "regenerate",
                          path: `${base}/invite`,
                          method: "post",
                          fields: [{ key: "expires_at", type: "date" }],
                          initial: {},
                        })
                      }
                    >
                      {t("shared.regenerate")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          api.save("post", `${base}/invite`, {
                            disabled: true,
                          }),
                        )
                      }
                    >
                      {t("shared.disableCode")}
                    </Button>
                  </div>
                )}
              </Card>
              {admin && (
                <Card>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          api.save("put", periodPath, {
                            closed: !data.period.closed,
                          }),
                        )
                      }
                    >
                      {t(
                        data.period.closed
                          ? "shared.reopenMonth"
                          : "shared.closeMonth",
                      )}
                    </Button>
                    {writable && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setDialog({
                              kind: "period",
                              title: "editBudget",
                              path: periodPath,
                              method: "put",
                              fields: [
                                moneyField("budget"),
                                moneyField("food_budget"),
                              ],
                              initial: {
                                budget: minor(data.period.budget_minor),
                                food_budget: minor(
                                  data.period.food_budget_minor,
                                ),
                              },
                            })
                          }
                        >
                          {t("shared.editBudget")}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setDialog({
                              kind: "copy",
                              title: "copyBills",
                              path: `${periodPath}/copy-bills`,
                              method: "post",
                              fields: [required("from", "month")],
                              initial: {},
                            })
                          }
                        >
                          {t("shared.copyBills")}
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-sm">{t("shared.copyHint")}</p>
                </Card>
              )}
              <Card>
                <h2 className="font-semibold">{t("shared.categoriesTitle")}</h2>
                {admin && (
                  <Button className="mt-3" onClick={() => openCategory()}>
                    {t("shared.addCategory")}
                  </Button>
                )}
                {data.categories.map((c) => (
                  <div
                    key={c.id}
                    className="mt-3 flex items-center justify-between gap-3"
                  >
                    <span>
                      {categoryLabel(c.id)} · {t(`shared.${c.kind}`)}{" "}
                      {c.archived && t("shared.archived")}
                    </span>
                    {admin && (
                      <Button
                        variant="secondary"
                        onClick={() => openCategory(c)}
                      >
                        {t("shared.edit")}
                      </Button>
                    )}
                  </div>
                ))}
              </Card>
            </>
          )}
          {tab === "activity" && (
            <div className="space-y-3">
              {data.activity.map((a) => (
                <Card key={a.id}>
                  <p>
                    {a.actor} · {t(`shared.actions.${a.action}`)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(a.created_at).toLocaleString(
                      language === "en" ? "en-PK" : "ur-Latn-PK",
                    )}
                  </p>
                  <AuditChanges
                    before={a.before_values}
                    after={a.after_values}
                  />
                </Card>
              ))}
            </div>
          )}
          </div>
        </>
      )}
      <Modal
        open={!!dialog}
        onClose={() => !busy && setDialog(null)}
        title={dialog ? t(`shared.${dialog.title}`) : ""}
        size="lg"
      >
        {error && (
          <p role="alert" className="mb-3">
            {t(error.startsWith("shared.") ? error : "shared.error")}
          </p>
        )}
        {dialog && (
          <LedgerForm
            key={`${dialog.kind}-${dialog.path}`}
            fields={dialog.fields}
            initial={dialog.initial}
            onSubmit={submit}
            busy={busy}
          >
            {["expenses", "bills"].includes(dialog.kind)
              ? (values, setValues) => (
                  <fieldset className="space-y-2">
                    <legend className="mb-2 font-semibold">
                      {t("shared.includedMembers")}
                    </legend>
                    <p className="text-sm text-slate-500">
                      {t("shared.splitHint")}
                    </p>
                    {data.summary.members
                      .filter(
                        (m) =>
                          m.joined_on <= values.date &&
                          (!m.left_on || m.left_on >= values.date),
                      )
                      .map((m) => {
                        const eligibleIds = data.summary.members
                          .filter(
                            (item) =>
                              item.joined_on <= values.date &&
                              (!item.left_on || item.left_on >= values.date),
                          )
                          .map((item) => item.id);
                        const included = values.included || eligibleIds;
                        return (
                          <div
                            key={m.id}
                            className="grid items-center gap-2 sm:grid-cols-2"
                          >
                            <label className="flex min-h-11 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={included.includes(m.id)}
                                onChange={(e) =>
                                  setValues({
                                    ...values,
                                    included: e.target.checked
                                      ? [...included, m.id]
                                      : included.filter((id) => id !== m.id),
                                  })
                                }
                              />
                              {m.name}
                            </label>
                            {["custom", "percentage", "weighted"].includes(
                              values.method,
                            ) &&
                              included.includes(m.id) && (
                                <Input
                                  label={`${m.name} · ${t(`shared.${values.method}`)}`}
                                  inputMode="decimal"
                                  pattern="(0|[1-9][0-9]*)(\.[0-9]{1,2})?"
                                  required
                                  value={
                                    values.values?.[m.id] ??
                                    (values.method === "weighted"
                                      ? m.weight
                                      : "")
                                  }
                                  onChange={(e) =>
                                    setValues({
                                      ...values,
                                      values: {
                                        ...values.values,
                                        [m.id]: e.target.value,
                                      },
                                    })
                                  }
                                />
                              )}
                          </div>
                        );
                      })}
                    <SharePreview
                      path={`${periodPath}/preview`}
                      values={values}
                      kind={dialog.kind}
                      members={data.summary.members}
                      currency={selected.currency}
                    />
                  </fieldset>
                )
              : undefined}
          </LedgerForm>
        )}
      </Modal>
    </div>
  );
}
