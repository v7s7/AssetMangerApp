// src/utils/api.js

// Prefer environment variable; fall back to your current server IP.
// Restart `npm start` after changing .env (REACT_APP_API_URL).
const API_URL = (process.env.REACT_APP_API_URL || 'http://10.27.16.97:4000').replace(/\/+$/, '');

// Small helper to standardize fetch + errors
async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  // Try to parse JSON; fall back to text for clearer errors
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');

  if (!res.ok) {
    const msg =
      (isJson && payload && (payload.error || payload.message)) ||
      (typeof payload === 'string' && payload) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return payload;
}

// Get all assets
export async function getAllAssets() {
  return request('/assets', { method: 'GET' });
}

// Add new asset
export async function addAsset(asset) {
  await request('/assets', {
    method: 'POST',
    body: JSON.stringify(asset),
  });
}

// Update existing asset, allow assetId to change
export async function updateAsset(updatedAsset, originalId) {
  const targetId = encodeURIComponent(originalId || updatedAsset.assetId);
  await request(`/assets/${targetId}`, {
    method: 'PUT',
    body: JSON.stringify(updatedAsset),
  });
}

// Delete asset by assetId
export async function deleteAsset(assetId) {
  if (!assetId) throw new Error('Asset ID is required for standard deletion');
  const id = encodeURIComponent(assetId);
  return request(`/assets/${id}`, { method: 'DELETE' });
}

// Force delete by assetId, macAddress, or ipAddress
export async function forceDeleteAsset({ assetId, macAddress, ipAddress }) {
  const params = new URLSearchParams();
  if (assetId) params.append('assetId', assetId);
  if (macAddress) params.append('macAddress', macAddress);
  if (ipAddress) params.append('ipAddress', ipAddress);

  return request(`/assets/force-delete?${params.toString()}`, { method: 'DELETE' });
}

// Get the next available asset ID (based on assetType)
export async function getNextAssetId(assetType = '') {
  const encodedType = encodeURIComponent(assetType);
  const { id } = await request(`/assets/next-id/${encodedType}`, { method: 'GET' });
  return id;
}

// (Optional alias)
export async function getNextAssetIdByType(assetType) {
  return getNextAssetId(assetType);
}
// Add below your existing exports

export async function scanNetwork(target) {
  const res = await fetch(`${API_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || 'Scan failed');
  }
  return res.json(); // returns array of asset-like payloads (not yet inserted)
}

export async function bulkAddAssets(assets) {
  const res = await fetch(`${API_URL}/assets/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assets })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || 'Bulk insert failed');
  }
  return res.json();
}
