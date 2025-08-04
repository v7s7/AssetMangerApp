const API_URL = 'http://10.27.16.58:4000';

// Get all assets
export async function getAllAssets() {
  const res = await fetch(`${API_URL}/assets`);
  if (!res.ok) throw new Error('Failed to fetch assets');
  return res.json();
}

// Add new asset
export async function addAsset(asset) {
  const res = await fetch(`${API_URL}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asset)
  });
  if (!res.ok) throw new Error('Failed to add asset');
}

// Update existing asset
export async function updateAsset(asset) {
  const res = await fetch(`${API_URL}/assets/${asset.assetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asset)
  });
  if (!res.ok) throw new Error('Failed to update asset');
}

// Delete asset by assetId (default method)
export async function deleteAsset(assetId) {
  if (!assetId) throw new Error('Asset ID is required for standard deletion');
  const res = await fetch(`${API_URL}/assets/${assetId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete asset');
  return res.json();
}

// Force delete asset using assetId, macAddress, or ipAddress
export async function forceDeleteAsset({ assetId, macAddress, ipAddress }) {
  const params = new URLSearchParams();
  if (assetId) params.append("assetId", assetId);
  if (macAddress) params.append("macAddress", macAddress);
  if (ipAddress) params.append("ipAddress", ipAddress);

  const res = await fetch(`${API_URL}/assets/force-delete?${params.toString()}`, {
    method: 'DELETE'
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Force delete failed: ${err}`);
  }

  return res.json();
}


// Get the next available asset ID
export async function getNextAssetId() {
  const res = await fetch(`${API_URL}/assets/next-id`);
  if (!res.ok) throw new Error('Failed to get next asset ID');
  const { id } = await res.json();
  return id;
}
