const { ptero } = require('./config');

const BASE   = ptero.domain;
const KEY    = ptero.pltc;
const SERVER = ptero.server;
const DIR    = ptero.path;

const H = {
  'Authorization': `Bearer ${KEY}`,
  'Accept':        'application/json',
};

async function loadDB() {
  const fp = encodeURIComponent(`${DIR}/users.json`);
  const r  = await fetch(`${BASE}/api/client/servers/${SERVER}/files/contents?file=${fp}`, { headers: H });
  if (r.status === 404) {
    const empty = { users: [], user_data: {} };
    await saveDB(empty);
    return empty;
  }
  if (!r.ok) throw new Error(`Pterodactyl read ${r.status}`);
  return JSON.parse(await r.text());
}

async function saveDB(db) {
  await ensureDir();
  const fp = encodeURIComponent(`${DIR}/users.json`);
  const r  = await fetch(`${BASE}/api/client/servers/${SERVER}/files/write?file=${fp}`, {
    method:  'POST',
    headers: { ...H, 'Content-Type': 'text/plain' },
    body:    JSON.stringify(db, null, 2),
  });
  if (!r.ok) throw new Error(`Pterodactyl write ${r.status}`);
}

async function ensureDir() {
  const fp = encodeURIComponent(DIR);
  const r  = await fetch(`${BASE}/api/client/servers/${SERVER}/files/list?directory=${fp}`, { headers: H });
  if (r.status === 404) {
    await fetch(`${BASE}/api/client/servers/${SERVER}/files/create-folder`, {
      method:  'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ root: '/', name: 'data' }),
    });
  }
}

module.exports = { loadDB, saveDB };
