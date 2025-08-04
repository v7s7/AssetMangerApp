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

// Update existing asset, allow assetId to change
export async function updateAsset(updatedAsset, originalId) {
  const targetId = originalId || updatedAsset.assetId;

  const res = await fetch(`${API_URL}/assets/${targetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedAsset)
  });

  if (!res.ok) throw new Error('Failed to update asset');
}

// Delete asset by assetId
export async function deleteAsset(assetId) {
  if (!assetId) throw new Error('Asset ID is required for standard deletion');
  const res = await fetch(`${API_URL}/assets/${assetId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete asset');
  return res.json();
}

// Force delete by assetId, macAddress, or ipAddress
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

// Get the next available asset ID (based on assetType)
export async function getNextAssetId(assetType = '') {
  const encodedType = encodeURIComponent(assetType);
  const res = await fetch(`${API_URL}/assets/next-id/${encodedType}`);
  if (!res.ok) throw new Error('Failed to get next asset ID');
  const { id } = await res.json();
  return id;
}

// (Optional alias)
export async function getNextAssetIdByType(assetType) {
  return getNextAssetId(assetType);
}
