
const API_BASE = '/api';

export const getConfigs = async () => {
    const res = await fetch(`${API_BASE}/configs`);
    return res.json();
};

export const getProxies = async () => {
    const res = await fetch(`${API_BASE}/proxies`);
    return res.json();
};

export const getRules = async () => {
    const res = await fetch(`${API_BASE}/rules`);
    return res.json();
};

export const getConnections = async () => {
    const res = await fetch(`${API_BASE}/connections`);
    return res.json();
};

export const closeConnection = async (id) => {
    await fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE' });
};

export const getTrafficWebSocket = (token = '') => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = new URL(`${protocol}//${host}/api/traffic`);
    if (token) url.searchParams.append('token', token);
    return new WebSocket(url.toString());
};

export const getLogsWebSocket = (level = 'info', token = '') => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = new URL(`${protocol}//${host}/api/logs?level=${level}`);
    if (token) url.searchParams.append('token', token);
    return new WebSocket(url.toString());
};

export const getMemoryWebSocket = (token = '') => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = new URL(`${protocol}//${host}/api/memory`);
    if (token) url.searchParams.append('token', token);
    return new WebSocket(url.toString());
};

/* --- Backend API (Profile Management) --- */
const BACKEND_BASE = '/backend';

export const getProfiles = async () => {
    const res = await fetch(`${BACKEND_BASE}/profiles`);
    return res.json();
};

export const importProfile = async (data) => {
    // data: { type: 'remote'|'local', url, content, name }
    const res = await fetch(`${BACKEND_BASE}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
};

export const selectProfile = async (id) => {
    const res = await fetch(`${BACKEND_BASE}/profiles/select/${id}`, { method: 'PUT' });
    return res.json();
};

export const deleteProfile = async (id) => {
    const res = await fetch(`${BACKEND_BASE}/profiles/${id}`, { method: 'DELETE' });
    return res.json();
};

export const updateProfile = async (id) => {
    const res = await fetch(`${BACKEND_BASE}/profiles/${id}`, { method: 'PUT' });
    return res.json();
};

export const patchProfile = async (id, data) => {
    const res = await fetch(`${BACKEND_BASE}/profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
};

// Actual Clash Core API
export const updateConfig = async (config) => {
    const res = await fetch(`${API_BASE}/configs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    // Clash API returns 204 No Content on success usually
    if (res.status === 204) return {};
    return res.json().catch(() => ({}));
};

export const getVersion = async () => {
    const res = await fetch(`${API_BASE}/version`);
    return res.json();
};

export const setProxy = async (groupName, nodeName) => {
    const res = await fetch(`${API_BASE}/proxies/${encodeURIComponent(groupName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nodeName })
    });
    return res.ok;
};

export const getProxyDelay = async (name, url = 'http://www.gstatic.com/generate_204', timeout = 5000) => {
    const res = await fetch(`${API_BASE}/proxies/${encodeURIComponent(name)}/delay?timeout=${timeout}&url=${encodeURIComponent(url)}`, {
        method: 'GET'
    });
    return res.json();
};

export const updatePreferences = async (data) => {
    const res = await fetch(`${BACKEND_BASE}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
};

export const getSystemInfo = async () => {
    const res = await fetch(`${BACKEND_BASE}/system_info`);
    return res.json();
};

export const getProfileContent = async (id) => {
    const res = await fetch(`${BACKEND_BASE}/profiles/${id}/content`);
    return res.json();
};

export const updateProfileContent = async (id, content) => {
    const res = await fetch(`${BACKEND_BASE}/profiles/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });
    return res.json();
};
