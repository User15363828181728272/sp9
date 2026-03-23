const { loadDB, saveDB } = require('./_db');
const { sha256, sign }   = require('./_jwt');
const cors               = require('./_cors');
const { admin }          = require('./config');

function safe(u) { const { password, ...s } = u; return s; }

module.exports = async (req, res) => {
  cors(res, 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action }             = req.query;
  const { username, password, nama } = req.body || {};

  if (action === 'login') {
    if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib' });

    if (username === admin.username && password === admin.password) {
      const u = { id: 'admin', nama: 'Admin Pagaska', username: admin.username, role: 'admin', generasi: '-', jabatan: 'Admin', bio: '' };
      return res.json({ token: sign({ id: 'admin', username: admin.username, role: 'admin' }), user: u });
    }

    const db   = await loadDB();
    const hash = sha256(password);
    const user = (db.users || []).find(u => u.username === username && u.password === hash);
    if (!user) return res.status(401).json({ error: 'Username atau password salah' });
    return res.json({ token: sign({ id: user.id, username: user.username, role: user.role }), user: safe(user) });
  }

  if (action === 'register') {
    if (!nama || !username || !password) return res.status(400).json({ error: 'Semua field wajib diisi' });
    if (username.length < 3)             return res.status(400).json({ error: 'Username minimal 3 karakter' });
    if (password.length < 6)             return res.status(400).json({ error: 'Password minimal 6 karakter' });
    if (username === admin.username)     return res.status(409).json({ error: 'Username tidak tersedia' });

    const db = await loadDB();
    if (!db.users)     db.users     = [];
    if (!db.user_data) db.user_data = {};

    if (db.users.find(u => u.username === username))
      return res.status(409).json({ error: 'Username sudah dipakai' });

    const id      = 'u' + Date.now();
    const newUser = {
      id, nama, username,
      password:   sha256(password),
      generasi:   req.body.generasi || '-',
      jabatan:    req.body.jabatan  || 'Anggota',
      role:       'user',
      bio:        '',
      created_at: new Date().toISOString(),
    };
    db.users.push(newUser);
    db.user_data[id] = { riwayat: [], liked: [], chat: {} };
    await saveDB(db);
    return res.status(201).json({ token: sign({ id, username, role: 'user' }), user: safe(newUser) });
  }

  return res.status(400).json({ error: 'Action tidak dikenali' });
};
