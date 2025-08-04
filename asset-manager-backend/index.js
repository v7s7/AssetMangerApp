const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// DB setup
const db = new sqlite3.Database('./assets.db');

db.run(`CREATE TABLE IF NOT EXISTS assets (
  assetId TEXT PRIMARY KEY,
  "group" TEXT,
  assetType TEXT,
  brandModel TEXT,
  serialNumber TEXT,
  assignedTo TEXT,
  ipAddress TEXT,
  macAddress TEXT,
  osFirmware TEXT,
  cpu TEXT,
  ram TEXT,
  storage TEXT,
  portDetails TEXT,
  powerConsumption TEXT,
  purchaseDate TEXT,
  warrantyExpiry TEXT,
  eol TEXT,
  maintenanceExpiry TEXT,
  cost TEXT,
  depreciation TEXT,
  residualValue TEXT,
  status TEXT,
  condition TEXT,
  usagePurpose TEXT,
  accessLevel TEXT,
  licenseKey TEXT,
  complianceStatus TEXT,
  documentation TEXT,
  remarks TEXT,
  lastAuditDate TEXT,
  disposedDate TEXT,
  replacementPlan TEXT
)`);

// === ROUTES ===

// Get all assets
app.get('/assets', (req, res) => {
  db.all('SELECT * FROM assets', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add new asset
app.post('/assets', (req, res) => {
  const asset = req.body;
  const fields = Object.keys(asset).map(f => f === 'group' ? `"group"` : f);
  const placeholders = fields.map(() => '?').join(',');
  const sql = `INSERT INTO assets (${fields.join(',')}) VALUES (${placeholders})`;

  db.run(sql, Object.values(asset), function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: asset.assetId });
  });
});

// Update asset by ID — allows ID change
app.put('/assets/:id', (req, res) => {
  const asset = req.body;
  const oldId = req.params.id;
  const newId = asset.assetId;

  if (!asset || Object.keys(asset).length === 0) {
    return res.status(400).json({ error: "No data provided for update" });
  }

  if (oldId !== newId) {
    // Delete old ID, insert new one
    db.run(`DELETE FROM assets WHERE assetId = ?`, oldId, function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const fields = Object.keys(asset).map(f => f === 'group' ? `"group"` : f);
      const placeholders = fields.map(() => '?').join(',');
      const sql = `INSERT INTO assets (${fields.join(',')}) VALUES (${placeholders})`;

      db.run(sql, Object.values(asset), function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ updated: 1 });
      });
    });
  } else {
    // Standard update
    const updates = Object.keys(asset)
      .map(k => `${k === 'group' ? `"group"` : k} = ?`)
      .join(', ');
    const sql = `UPDATE assets SET ${updates} WHERE assetId = ?`;
    const values = [...Object.values(asset), oldId];

    db.run(sql, values, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    });
  }
});

// Delete by assetId only
app.delete('/assets/:id', (req, res) => {
  db.run(`DELETE FROM assets WHERE assetId = ?`, req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Force delete: assetId, macAddress or ipAddress via query params
app.delete('/assets/force-delete', (req, res) => {
  const { assetId, macAddress, ipAddress } = req.query;

  if (!assetId && !macAddress && !ipAddress) {
    return res.status(400).json({ error: 'Must provide at least assetId, macAddress, or ipAddress' });
  }

  const conditions = [];
  const params = [];

  if (assetId) {
    conditions.push('assetId = ?');
    params.push(assetId);
  }
  if (macAddress) {
    conditions.push('macAddress = ?');
    params.push(macAddress);
  }
  if (ipAddress) {
    conditions.push('ipAddress = ?');
    params.push(ipAddress);
  }

  const sql = `DELETE FROM assets WHERE ${conditions.join(' OR ')}`;

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Get next ID based on assetType
app.get('/assets/next-id/:type', (req, res) => {
  const rawType = req.params.type;

  if (!rawType || rawType.length < 2) {
    return res.status(400).json({ error: 'Invalid asset type' });
  }

  const safePrefix = rawType
    .replace(/[^a-zA-Z0-9]/g, '') // remove special chars
    .toUpperCase()
    .slice(0, 3);

  if (!safePrefix) {
    return res.status(400).json({ error: 'Invalid asset type prefix' });
  }

  db.all(`SELECT assetId FROM assets WHERE assetId LIKE '${safePrefix}-%'`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const numbers = rows
      .map(row => {
        const match = row.assetId.match(new RegExp(`^${safePrefix}-(\\d+)$`));
        return match ? parseInt(match[1]) : null;
      })
      .filter(n => n !== null);

    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    const id = `${safePrefix}-${String(next).padStart(3, '0')}`;
    res.json({ id });
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://10.27.16.58:${PORT}`);
});
