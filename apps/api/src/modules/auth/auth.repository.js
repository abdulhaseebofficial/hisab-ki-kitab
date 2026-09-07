/**
 * The refresh_tokens table.
 *
 * Only hashes are stored, one row per signed-in device, so a database dump
 * yields no usable session.
 *
 * A row is not deleted when it is exchanged - it is marked rotated and told
 * what replaced it. That is what lets two tabs racing for the same refresh be
 * told apart from a stolen cookie being replayed; see auth.service for the
 * judgement that uses it.
 *
 * revokeAllSessions is deliberately NOT here: it deletes these rows *and*
 * bumps the account's token_version in one transaction, which makes it an
 * operation on the account rather than on this table. It lives with users, and
 * auth reaches it through users.service.
 */

const { query, queryOne, transaction } = require('../../infrastructure/database/pool');
const { toApi } = require('../../infrastructure/database/rows');

/**
 * Records one session, prunes expired rows, and keeps only the newest `max`
 * live sessions so a student cannot accumulate them without limit.
 */
const addRefreshToken = async (userId, tokenHash, expiresAt, max) =>
  transaction(async (tx) => {
    await tx.query(`DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at <= now()`, [
      userId,
    ]);
    await tx.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO NOTHING`,
      [userId, tokenHash, expiresAt]
    );

    // The session cap counts LIVE sessions. Rotated rows are the short-lived
    // paper trail of a refresh, not devices someone is signed in on, and
    // counting them would evict real sessions after a few page reloads.
    await tx.query(
      `DELETE FROM refresh_tokens
        WHERE user_id = $1
          AND rotated_at IS NULL
          AND id NOT IN (
            SELECT id FROM refresh_tokens
             WHERE user_id = $1 AND rotated_at IS NULL
             ORDER BY created_at DESC LIMIT $2
          )`,
      [userId, max]
    );
  });

/**
 * The stored row for a token, or null.
 *
 * Returns the rotation columns as well as existence, because the caller has to
 * distinguish three cases - live, just-rotated, and unknown - and collapsing
 * them into a boolean is what made a second tab look like an attacker.
 */
const findRefreshToken = async (userId, tokenHash) => {
  const row = await queryOne(
    `SELECT token_hash, rotated_at, replaced_by, expires_at
       FROM refresh_tokens
      WHERE user_id = $1 AND token_hash = $2 AND expires_at > now()`,
    [userId, tokenHash]
  );
  // Through toApi, so the caller reads rotatedAt rather than rotated_at. Left
  // raw, every rotation check silently evaluated undefined and the grace path
  // was never taken - the tests passed for the wrong reason.
  return toApi(row);
};

/**
 * Marks a token exchanged, recording what took its place.
 *
 * Conditional on the row still being live, and the result says whether it won.
 * Two requests arriving together therefore cannot both rotate the same row:
 * exactly one UPDATE matches, and the other is told to take the grace path.
 */
const rotateRefreshToken = async (userId, tokenHash, replacementHash) => {
  const row = await queryOne(
    `UPDATE refresh_tokens
        SET rotated_at = now(), replaced_by = $3
      WHERE user_id = $1 AND token_hash = $2 AND rotated_at IS NULL
      RETURNING token_hash`,
    [userId, tokenHash, replacementHash]
  );
  return Boolean(row);
};

/**
 * True when a rotated token's replacement is still the LIVE end of the chain.
 *
 * Live, not merely present. This keeps the grace window as narrow as it can be
 * while still fixing two tabs: a second tab arrives within milliseconds, before
 * the winner has had any chance to refresh again, so the replacement is
 * untouched and the race is served. A copy of the same token surfacing later -
 * after the real session has moved on even once - finds the replacement already
 * rotated, and is treated as the replay it is.
 */
const replacementIsLive = async (userId, tokenHash) => {
  if (!tokenHash) return false;
  const row = await queryOne(
    `SELECT 1 AS ok FROM refresh_tokens
      WHERE user_id = $1 AND token_hash = $2 AND expires_at > now() AND rotated_at IS NULL`,
    [userId, tokenHash]
  );
  return Boolean(row);
};

const removeRefreshToken = async (userId, tokenHash) => {
  await query(`DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2`, [
    userId,
    tokenHash,
  ]);
};

module.exports = {
  addRefreshToken,
  findRefreshToken,
  rotateRefreshToken,
  replacementIsLive,
  removeRefreshToken,
};
