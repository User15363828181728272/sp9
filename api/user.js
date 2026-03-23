const { loadDB, saveDB }      = require('./_db');
const { requireAuth, sha256 } = require('./_jwt');
const cors                    = require('./_cors');

function safe(u) { const { password, ...s } = u; return s; }

module.exports = async (req, res) => {
  cors(res, 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let me;
  try { me = requireAuth(req); } catch (e) { return res.status(401).json({ error: e.message }); }

  if (me.id === 'admin') {
    if (req.method === 'GET') return res.json({ id: 'admin', nama: 'Admin Pagaska', username: 'admin', role: 'admin', generasi: '-', jabatan: 'Admin', bio: '', riwayat_count: 0, liked_count: 0 });
    return res.status(403).json({ error: 'Admin tidak bisa edit profil' });
  }

  const db  = await loadDB();
  const idx = (db.users || []).findIndex(u => u.id === me.id);
  if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan' });

  if (req.method === 'GET') {
    const ud = db.user_data?.[me.id] || {};
    return res.json({ ...safe(db.users[idx]), riwayat_count: (ud.riwayat || []).length, liked_count: (ud.liked || []).length });
  }

  const { action } = req.query;

  if (action === 'update') {
    const u = db.users[idx];
    const { nama, bio, generasi, jabatan } = req.body || {};
    if (nama)             u.nama     = nama;
    if (bio !== undefined) u.bio     = bio;
    if (generasi)         u.generasi = generasi;
    if (jabatan)          u.jabatan  = jabatan;
    db.users[idx] = u;
    await saveDB(db);
    return res.json({ user: safe(u) });
  }

  if (action === 'change-password') {
    const { old_password, new_password } = req.body || {};
    if (!old_password || !new_password) return res.status(400).json({ error: 'Field tidak boleh kosong' });
    if (new_password.length < 6)        return res.status(400).json({ error: 'Password minimal 6 karakter' });
    const u = db.users[idx];
    if (u.password !== sha256(old_password)) return res.status(401).json({ error: 'Password lama salah' });
    u.password    = sha256(new_password);
    db.users[idx] = u;
    await saveDB(db);
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Action tidak dikenali' });
};
