const API = (() => {
  const TK = 'pgsk_token';
  const UK = 'pgsk_user';
  const tok  = () => localStorage.getItem(TK) || '';
  const user = () => { try { return JSON.parse(localStorage.getItem(UK) || 'null'); } catch { return null; } };
  function setAuth(t, u) { localStorage.setItem(TK, t); localStorage.setItem(UK, JSON.stringify(u)); }
  function clearAuth()   { localStorage.removeItem(TK); localStorage.removeItem(UK); }

  async function call(method, path, body, noAuth) {
    const h = { 'Content-Type': 'application/json' };
    if (!noAuth) h['Authorization'] = 'Bearer ' + tok();
    const opts = { method, headers: h };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    let data; try { data = await r.json(); } catch { data = {}; }
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  return {
    isLoggedIn: () => !!tok() && !!user(),
    getUser:    () => user(),
    logout:     () => { clearAuth(); location.href = '/login'; },

    login:    (username, password) => call('POST', '/api/auth?action=login',    { username, password }, true).then(d => { setAuth(d.token, d.user); return d; }),
    register: (nama, username, password) => call('POST', '/api/auth?action=register', { nama, username, password }, true).then(d => { setAuth(d.token, d.user); return d; }),

    getProfile:     ()     => call('GET',  '/api/user'),
    updateProfile:  (body) => call('POST', '/api/user?action=update', body),
    changePassword: (body) => call('POST', '/api/user?action=change-password', body),

    getRiwayat:  ()      => call('GET',    '/api/history?type=riwayat'),
    getLiked:    ()      => call('GET',    '/api/history?type=liked'),
    addRiwayat:  (track) => call('POST',   '/api/history?type=riwayat', track),
    toggleLiked: (track) => call('POST',   '/api/history?type=liked',   track),
    delRiwayat:  (id)    => call('DELETE', `/api/history?type=riwayat&id=${id}`),
    delLiked:    (id)    => call('DELETE', `/api/history?type=liked&id=${id}`),

    getConvs:     ()       => call('GET',    '/api/chat'),
    getMsgs:      (pid)    => call('GET',    `/api/chat?with=${pid}`),
    sendMsg:      (body)   => call('POST',   '/api/chat?action=send', body),
    deleteMsg:    (id,pid) => call('DELETE', `/api/chat?id=${id}&with=${pid}`),
    getChatUsers: ()       => call('GET',    '/api/chat?action=users'),

    scSearch:   (q)   => call('GET',  `/api/sc?action=search&q=${encodeURIComponent(q)}`, null, true),
    scRandom:   ()    => call('GET',  '/api/sc?action=random', null, true),
    scDownload: (url) => call('POST', '/api/sc?action=download', { url }, true),
  };
})();
window.API = API;
