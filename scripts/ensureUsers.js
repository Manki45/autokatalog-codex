// scripts/ensureUsers.js
// Erstellt/aktualisiert einen Admin-User (nur Hash) anhand von ENV-Variablen.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS; // bewusst kein Default!
const ADMIN_ROLE = process.env.ADMIN_ROLE || 'admin';

(async () => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      try {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(raw || '[]');
        if (!Array.isArray(users)) users = [];
      } catch {
        users = [];
      }
    }

    if (!ADMIN_PASS) {
      console.log('[ensureUsers] ADMIN_PASS nicht gesetzt – übersprungen.');
      process.exit(0);
    }

    const saltRounds = 10;
    const hash = await bcrypt.hash(ADMIN_PASS, saltRounds);

    const adminObj = {
      id: `admin-${ADMIN_USER}`,
      username: ADMIN_USER,
      passwordHash: hash,
      role: ADMIN_ROLE
    };

    const idx = users.findIndex(u => u && u.username === ADMIN_USER);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...adminObj };
      console.log(`[ensureUsers] Admin '${ADMIN_USER}' aktualisiert.`);
    } else {
      users.push(adminObj);
      console.log(`[ensureUsers] Admin '${ADMIN_USER}' erstellt.`);
    }

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log(`[ensureUsers] users.json geschrieben: ${USERS_FILE}`);
    process.exit(0);
  } catch (err) {
    console.error('[ensureUsers] Fehler:', err);
    process.exit(1);
  }
})();