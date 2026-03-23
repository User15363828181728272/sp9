const { loadDB, saveDB } = require('./_db');
const { requireAuth }    = require('./_jwt');
const cors               = require('./_cors');

function ensureUD(db, uid) {
  if (!db.user_data)           db.user_data = {};
  if (!db.user_data[uid])      db.user_data[uid] = { riwayat: [], liked: [], chat: {} };
  if (!db.user_data[uid].chat) db.user_data[uid].chat = {};
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let me;
  try { me = requireAuth(req); } catch (e) { return res.status(401).json({ error: e.message }); }

  const db     = await loadDB();
  const action = req.query.action;
  const withId = req.query.with;

  if (req.method === 'GET' && action === 'users') {
    const list = (db.users || []).filter(u => u.id !== me.id).map(u => ({ id: u.id, nama: u.nama, username: u.username, generasi: u.generasi, jabatan: u.jabatan }));
    return res.json(list);
  }

  if (req.method === 'GET' && !withId) {
    ensureUD(db, me.id);
    const myChat = db.user_data[me.id].chat;
    const convs  = Object.entries(myChat).map(([pid, msgs]) => {
      const arr    = Array.isArray(msgs) ? msgs : [];
      const last   = arr[arr.length - 1] || null;
      const unread = arr.filter(m => !m.read && m.from !== me.id).length;
      const partner = db.users?.find(u => u.id === pid);
      return { partner_id: pid, partner_nama: partner?.nama || pid, partner_gen: partner?.generasi || '-', last_msg: last, unread };
    }).sort((a, b) => (b.last_msg?.time || '').localeCompare(a.last_msg?.time || ''));
    return res.json(convs);
  }

  if (req.method === 'GET' && withId) {
    ensureUD(db, me.id);
    const msgs = db.user_data[me.id].chat[withId] || [];
    msgs.forEach(m => { if (m.from !== me.id) m.read = true; });
    db.user_data[me.id].chat[withId] = msgs;
    await saveDB(db);
    return res.json(msgs);
  }

  if (req.method === 'POST' && action === 'send') {
    const { to, content, track, reply_to } = req.body || {};
    if (!to)                   return res.status(400).json({ error: 'field "to" wajib' });
    if (!content && !track)    return res.status(400).json({ error: 'Isi pesan atau kirim lagu' });
    if (to !== 'admin' && !(db.users || []).find(u => u.id === to))
      return res.status(404).json({ error: 'User tujuan tidak ditemukan' });

    ensureUD(db, me.id);
    if (to !== 'admin') ensureUD(db, to);

    const msg = {
      id:       `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      from:     me.id,
      to,
      content:  content  || null,
      track:    track    || null,
      reply_to: reply_to || null,
      time:     new Date().toISOString(),
      read:     false,
    };

    if (!db.user_data[me.id].chat[to])   db.user_data[me.id].chat[to]   = [];
    db.user_data[me.id].chat[to].push(msg);

    if (to !== 'admin') {
      if (!db.user_data[to].chat[me.id]) db.user_data[to].chat[me.id]   = [];
      db.user_data[to].chat[me.id].push({ ...msg, read: false });
    }

    await saveDB(db);
    return res.status(201).json(msg);
  }

  if (req.method === 'DELETE') {
    const { id: msgId, with: pid } = req.query;
    if (!msgId || !pid) return res.status(400).json({ error: 'id dan with wajib' });
    ensureUD(db, me.id);
    db.user_data[me.id].chat[pid] = (db.user_data[me.id].chat[pid] || []).filter(m => !(m.id === msgId && m.from === me.id));
    await saveDB(db);
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Action tidak dikenali' });
};
