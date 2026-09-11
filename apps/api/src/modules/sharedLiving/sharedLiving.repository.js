const db = require("../../infrastructure/database/pool");

// Identifiers can only originate in this module's allowlist, never in a request.
const TABLES = Object.freeze({
  spaces: "sl_spaces",
  members: "sl_members",
  categories: "sl_categories",
  expenses: "sl_expenses",
  bills: "sl_bills",
  payments: "sl_payments",
  periods: "sl_periods",
});
const insert = (tx, kind, values) => {
  const table = TABLES[kind];
  if (!table) throw new Error("Unknown ledger entity");
  const keys = Object.keys(values);
  return tx.queryOne(
    `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
    Object.values(values),
  );
};
const update = (tx, kind, spaceId, id, values) => {
  const table = TABLES[kind];
  if (!table) throw new Error("Unknown ledger entity");
  const keys = Object.keys(values);
  return tx.queryOne(
    `UPDATE ${table} SET ${keys.map((key, i) => `${key}=$${i + 1}`).join(",")} WHERE id=$${keys.length + 1} AND ${kind === "spaces" ? "id" : "space_id"}=$${keys.length + 2} RETURNING *`,
    [...Object.values(values), id, spaceId],
  );
};
const find = (tx, kind, spaceId, id) =>
  tx.queryOne(`SELECT * FROM ${TABLES[kind]} WHERE id=$1 AND space_id=$2`, [
    id,
    spaceId,
  ]);
const findRequest = (tx, kind, spaceId, requestId) =>
  tx.queryOne(`SELECT * FROM ${TABLES[kind]} WHERE space_id=$1 AND request_id=$2`, [spaceId, requestId]);
const spaces = (userId) =>
  db.query(
    "SELECT s.*,m.role FROM sl_spaces s JOIN sl_memberships m ON m.space_id=s.id WHERE m.user_id=$1 ORDER BY s.created_at,s.id",
    [userId],
  );
const access = (tx, spaceId, userId) =>
  tx.queryOne(
    "SELECT s.*,m.role FROM sl_spaces s JOIN sl_memberships m ON m.space_id=s.id WHERE s.id=$1 AND m.user_id=$2 FOR UPDATE OF s",
    [spaceId, userId],
  );
const audit = (tx, spaceId, actor, action, entity, id, before, after) =>
  tx.query(
    "INSERT INTO sl_activity(space_id,actor_id,actor_name,action,entity,entity_id,before_values,after_values) VALUES($1,$2,(SELECT name FROM users WHERE id=$2),$3,$4,$5,$6,$7)",
    [
      spaceId,
      actor,
      action,
      entity,
      id,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    ],
  );
const period = (tx, spaceId, month) =>
  tx.queryOne(
    "SELECT *,to_char(month,'YYYY-MM') AS month_key FROM sl_periods WHERE space_id=$1 AND month=$2::date",
    [spaceId, `${month}-01`],
  );
const members = (tx, spaceId) =>
  tx.query(
    "SELECT *,to_char(joined_on,'YYYY-MM-DD') AS joined_on,to_char(left_on,'YYYY-MM-DD') AS left_on,weight::text AS weight FROM sl_members WHERE space_id=$1 ORDER BY sl_members.joined_on,sl_members.id",
    [spaceId],
  );
const records = (tx, kind, spaceId, periodId) =>
  tx.query(
    `SELECT *,to_char(date,'YYYY-MM-DD') AS date ${kind === "bills" ? ",to_char(due_date,'YYYY-MM-DD') AS due_date" : ""} FROM ${TABLES[kind]} WHERE space_id=$1 AND period_id=$2 AND NOT deleted ORDER BY ${TABLES[kind]}.date,${TABLES[kind]}.id`,
    [spaceId, periodId],
  );
const shares = (tx, spaceId, periodId) =>
  tx.query(
    "SELECT s.*,CASE WHEN s.expense_id IS NULL THEN 'bill' ELSE 'expense' END AS kind FROM sl_shares s LEFT JOIN sl_expenses e ON e.id=s.expense_id LEFT JOIN sl_bills b ON b.id=s.bill_id WHERE s.space_id=$1 AND ((e.period_id=$2 AND NOT e.deleted) OR (b.period_id=$2 AND NOT b.deleted))",
    [spaceId, periodId],
  );
module.exports = {
  transaction: db.transaction,
  insert,
  update,
  find,
  findRequest,
  spaces,
  access,
  audit,
  period,
  members,
  records,
  shares,
};
