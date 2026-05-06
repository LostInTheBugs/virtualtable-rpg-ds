// ── Client API centralisé ────────────────────────────────────
const API_BASE = '/rpg/api';

function getToken() { return localStorage.getItem('rpg_token'); }
function setToken(t) { localStorage.setItem('rpg_token', t); }
function clearToken() { localStorage.removeItem('rpg_token'); localStorage.removeItem('rpg_user'); }
function getUser() { try { return JSON.parse(localStorage.getItem('rpg_user')); } catch { return null; } }
function setUser(u) { localStorage.setItem('rpg_user', JSON.stringify(u)); }

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const API = {
  auth: {
    register: (username, email, password, invite_code, website = '') =>
      apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password, invite_code, website }) }),
    login: (email, password, website = '') =>
      apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, website }) }),
    me: () => apiFetch('/auth/me'),
  },
  campaigns: {
    list: () => apiFetch('/campaigns'),
    get: (id) => apiFetch(`/campaigns/${id}`),
    create: (data) => apiFetch('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    join: (code) => apiFetch('/campaigns/join', { method: 'POST', body: JSON.stringify({ invite_code: code }) }),
    delete: (id) => apiFetch(`/campaigns/${id}`, { method: 'DELETE' }),
  },
  characters: {
    list: (cid) => apiFetch(`/campaigns/${cid}/characters`),
    create: (cid, data) => apiFetch(`/campaigns/${cid}/characters`, { method: 'POST', body: JSON.stringify(data) }),
    update: (cid, charId, data) => apiFetch(`/campaigns/${cid}/characters/${charId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (cid, charId) => apiFetch(`/campaigns/${cid}/characters/${charId}`, { method: 'DELETE' }),
  },
  maps: {
    list: (cid) => apiFetch(`/campaigns/${cid}/maps`),
    create: (cid, data) => apiFetch(`/campaigns/${cid}/maps`, { method: 'POST', body: JSON.stringify(data) }),
    update: (cid, mapId, data) => apiFetch(`/campaigns/${cid}/maps/${mapId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    tokens: (cid, mapId) => apiFetch(`/campaigns/${cid}/maps/${mapId}/tokens`),
    activate: (cid, mapId) => apiFetch(`/campaigns/${cid}/maps/${mapId}/activate`, { method: 'PUT' }),
  },

  account: {
    me:              ()       => apiFetch('/account/me'),
    updateProfile:   (data)   => apiFetch('/account/profile',          { method: 'PUT',    body: JSON.stringify(data) }),
    changePassword:  (data)   => apiFetch('/account/password',         { method: 'PUT',    body: JSON.stringify(data) }),
    ownedCampaigns:  ()       => apiFetch('/account/owned-campaigns'),
    deleteAccount:   (data)   => apiFetch('/account',                  { method: 'DELETE', body: JSON.stringify(data) }),
  },

  tables: {
    list:   (cid)            => apiFetch(`/campaigns/${cid}/tables`),
    create: (cid, data)      => apiFetch(`/campaigns/${cid}/tables`,        { method: 'POST',   body: JSON.stringify(data) }),
    update: (cid, tid, data) => apiFetch(`/campaigns/${cid}/tables/${tid}`, { method: 'PUT',    body: JSON.stringify(data) }),
    delete: (cid, tid)       => apiFetch(`/campaigns/${cid}/tables/${tid}`, { method: 'DELETE' }),
  },

  handouts: {
    list:   (cid)           => apiFetch(`/campaigns/${cid}/handouts`),
    create: (cid, data)     => apiFetch(`/campaigns/${cid}/handouts`,       { method: 'POST',   body: JSON.stringify(data) }),
    update: (cid, hid, data)=> apiFetch(`/campaigns/${cid}/handouts/${hid}`, { method: 'PUT',   body: JSON.stringify(data) }),
    share:  (cid, hid)      => apiFetch(`/campaigns/${cid}/handouts/${hid}/share`, { method: 'PUT' }),
    delete: (cid, hid)      => apiFetch(`/campaigns/${cid}/handouts/${hid}`, { method: 'DELETE' }),
  },

  macros: {
    list:   ()           => apiFetch('/macros'),
    create: (data)       => apiFetch('/macros',     { method: 'POST',   body: JSON.stringify(data) }),
    update: (id, data)   => apiFetch(`/macros/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id)         => apiFetch(`/macros/${id}`, { method: 'DELETE' }),
  },

  // Upload d'image — renvoie { url: '/uploads/uuid.ext' }
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    return fetch(API_BASE + '/upload', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: form,
    }).then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      return data;
    });
  },
};
