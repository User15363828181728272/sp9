const { loadDB, saveDB } = require('./_db');
const { requireAuth }    = require('./_jwt');
const cors               = require('./_cors');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let me;
  try { me = requireAuth(req); } catch (e) { return res.status(401).json({ error: e.message }); }

  const db = await loadDB();
  if (!db.user_data)        db.user_data = {};
  if (!db.user_data[me.id]) db.user_data[me.id] = { riwayat: [], liked: [], chat: {} };

  const ud   = db.user_data[me.id];
  const type = req.query.type;

  if (req.method === 'GET') {
    return res.json(type === 'liked' ? (ud.liked || []) : (ud.riwayat || []));
  }

  if (req.method === 'POST') {
    const track = req.body;
    if (!track?.id) return res.status(400).json({ error: 'track.id wajib' });

    if (type === 'liked') {
      ud.liked    = ud.liked || [];
      const idx   = ud.liked.findIndex(t => t.id === track.id);
      if (idx > -1) { ud.liked.splice(idx, 1); db.user_data[me.id] = ud; await saveDB(db); return res.json({ action: 'unliked' }); }
      ud.liked.unshift({ ...track, liked_at: new Date().toISOString() });
      db.user_data[me.id] = ud; await saveDB(db);
      return res.json({ action: 'liked' });
    }

    ud.riwayat = [{ ...track, played_at: new Date().toISOString() }, ...(ud.riwayat || []).filter(t => t.id !== track.id)].slice(0, 100);
    db.user_data[me.id] = ud;
    await saveDB(db);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id wajib' });
    if (type === 'liked') ud.liked   = (ud.liked   || []).filter(t => t.id !== id);
    else                  ud.riwayat = (ud.riwayat || []).filter(t => t.id !== id);
    db.user_data[me.id] = ud;
    await saveDB(db);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
