/**
 * The alert tray. Replaces models/Notification.js.
 */

const { query, queryOne } = require('../../infrastructure/database/pool');
const { toApi, toApiList, isUuid } = require('../../infrastructure/database/rows');

/**
 * Newest first, optionally only the unread ones - in one finance mode.
 *
 * Scoped to the mode because every alert is *about* one: a budget limit, a
 * recurring bill, a category. Without this a householder who switched back to
 * student mode kept finding warnings about a gas bill in a life that has no
 * gas bill, and no way to act on them.
 */
const list = async (userId, financeMode, { limit = 20, unreadOnly = false } = {}) => {
  const rows = await query(
    `SELECT * FROM notifications
      WHERE user_id = $1 AND finance_mode = $2 ${unreadOnly ? 'AND NOT is_read' : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT $3`,
    // Clamped at both ends: an upper bound stops a caller asking for the whole
    // table, and a lower bound stops a negative reaching Postgres, where
    // `LIMIT -5` is an error rather than an empty page.
    [userId, financeMode, Math.min(50, Math.max(1, Number(limit) || 20))]
  );
  return toApiList(rows);
};

/** The bell badge counts only what is unread in the mode being looked at. */
const unreadCount = async (userId, financeMode) => {
  const row = await queryOne(
    `SELECT count(*)::bigint AS n
       FROM notifications
      WHERE user_id = $1 AND finance_mode = $2 AND NOT is_read`,
    [userId, financeMode]
  );
  return Number(row.n);
};

/**
 * Raises an alert, unless one with the same dedupe key already exists for this
 * student - that is what stops the same overspend warning arriving every time
 * the rules run. Returns the new row, or null when it was a duplicate.
 */
const push = async (userId, financeMode, { type, title, message, meta = {}, dedupeKey = null }) => {
  const row = await queryOne(
    `INSERT INTO notifications (user_id, finance_mode, type, title, message, meta, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [userId, financeMode, type, title, message, JSON.stringify(meta || {}), dedupeKey]
  );
  return toApi(row);
};

const markRead = async (id, userId) => {
  if (!isUuid(id)) return null;
  const row = await queryOne(
    `UPDATE notifications SET is_read = true, updated_at = now()
      WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  return toApi(row);
};

const markAllRead = async (userId) => {
  const rows = await query(
    `UPDATE notifications SET is_read = true, updated_at = now()
      WHERE user_id = $1 AND NOT is_read RETURNING id`,
    [userId]
  );
  return rows.length;
};

const remove = async (id, userId) => {
  if (!isUuid(id)) return false;
  const rows = await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
};

const clearAll = async (userId) => {
  await query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
};

module.exports = { list, unreadCount, push, markRead, markAllRead, remove, clearAll };
