const { db } = require('../db');
const { ROLES } = require('../constants');

// Prepared statements for user-related queries
const findByIdStmt = db.prepare('SELECT id, username, role, disabled FROM users WHERE id = ?');
const findByUsernameStmt = db.prepare('SELECT * FROM users WHERE username = ?');
const getFullByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const countUsersStmt = db.prepare('SELECT COUNT(*) as count FROM users');

const createStmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
const updatePasswordStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const updateRoleStmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
const updateDisabledStmt = db.prepare('UPDATE users SET disabled = ? WHERE id = ?');
const updateGeminiApiKeyStmt = db.prepare('UPDATE users SET gemini_api_key = ? WHERE id = ?');
const updateGeminiPromptStmt = db.prepare('UPDATE users SET gemini_prompt = ? WHERE id = ?');
const updatePreferredLanguagesStmt = db.prepare('UPDATE users SET preferred_languages = ? WHERE id = ?');
const updateGeminiModelStmt = db.prepare('UPDATE users SET gemini_model = ? WHERE id = ?');

const getRecentStmt = db.prepare('SELECT id, username, role, disabled, created_at FROM users ORDER BY created_at DESC LIMIT ?');
const listWithSongCountStmt = db.prepare(`
  SELECT u.id, u.username, u.role, u.disabled, u.created_at,
         COUNT(s.id) as song_count
  FROM users u LEFT JOIN songs s ON u.id = s.user_id
  GROUP BY u.id
  ORDER BY u.created_at ASC
`);

const createUser = (username, passwordHash, role) => ({ id: createStmt.run(username, passwordHash, role).lastInsertRowid, role });

const deleteUnusedInvitesByUserStmt = db.prepare('DELETE FROM invites WHERE created_by = ? AND used_at IS NULL');
const clearInviteCreatorStmt = db.prepare('UPDATE invites SET created_by = NULL WHERE created_by = ?');
const clearInviteUserStmt = db.prepare('UPDATE invites SET used_by = NULL WHERE used_by = ?');
const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');

// Counting and inserting in one transaction stops two first sign-ups both becoming owner.
const registerTransaction = db.transaction((username, passwordHash, assertCanJoin) => {
  const userCount = countUsersStmt.get().count;
  assertCanJoin(userCount);
  return createUser(username, passwordHash, userCount === 0 ? ROLES.OWNER : ROLES.USER);
});

// Songs and setlists cascade; invite references have no ON DELETE action, so clear them first.
const deleteUserTransaction = db.transaction((id) => {
  deleteUnusedInvitesByUserStmt.run(id);
  clearInviteCreatorStmt.run(id);
  clearInviteUserStmt.run(id);
  return deleteUserStmt.run(id);
});

module.exports = {
  findById: (id) => findByIdStmt.get(id),
  findByUsername: (username) => findByUsernameStmt.get(username),
  getFullById: (id) => getFullByIdStmt.get(id),
  count: () => countUsersStmt.get(),
  getRecent: (limit) => getRecentStmt.all(limit),
  listWithSongCount: () => listWithSongCountStmt.all(),

  create: createUser,
  register: (username, passwordHash, assertCanJoin) => registerTransaction(username, passwordHash, assertCanJoin),
  updatePassword: (id, passwordHash) => updatePasswordStmt.run(passwordHash, id),
  updateRole: (id, role) => updateRoleStmt.run(role, id),
  updateDisabled: (id, disabled) => updateDisabledStmt.run(disabled ? 1 : 0, id),
  updateGeminiApiKey: (id, key) => updateGeminiApiKeyStmt.run(key, id),
  updateGeminiPrompt: (id, prompt) => updateGeminiPromptStmt.run(prompt, id),
  updatePreferredLanguages: (id, languages) => updatePreferredLanguagesStmt.run(languages, id),
  updateGeminiModel: (id, model) => updateGeminiModelStmt.run(model, id),

  delete: (id) => deleteUserTransaction(id),
};
