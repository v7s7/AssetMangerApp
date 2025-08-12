// index.js (full updated)

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// DB setup
const db = new sqlite3.Database('./assets.db');

// Assets table
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

// Reserved asset IDs table
db.run(`CREATE TABLE IF NOT EXISTS used_ids (
  assetId TEXT PRIMARY KEY
)`);

// --- Helpers ---
function requireMinimalFields(body) {
  const required = ['group', 'assetType', 'assetId'];
  const missing = required.filter(
    (f) => !body[f] || String(body[f]).trim() === ''
  );
  return missing;
}

function rollback(e, res) {
  db.run('ROLLBACK', () => res.status(500).json({ error: e.message }));
}

// === ROUTES ===

// Health check (optional)
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

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

  const missing = requireMinimalFields(asset);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const fields = Object.keys(asset).map(f => (f === 'group' ? `"group"` : f));
  const placeholders = fields.map(() => '?').join(',');
  const sql = `INSERT INTO assets (${fields.join(',')}) VALUES (${placeholders})`;

  db.run(sql, Object.values(asset), function (err) {
    if (err) return res.status(500).json({ error: err.message });

    db.run(`INSERT OR IGNORE INTO used_ids (assetId) VALUES (?)`, [asset.assetId]);
    res.status(201).json({ id: asset.assetId });
  });
});

// Bulk insert assets
app.post('/assets/bulk', (req, res) => {
  const list = req.body?.assets;
  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: 'No assets provided' });
  }

  const required = ['assetId', 'group', 'assetType'];
  const badIdx = list.findIndex(a => required.some(f => !a[f] || String(a[f]).trim() === ''));
  if (badIdx >= 0) {
    return res.status(400).json({ error: `Asset at index ${badIdx} missing required fields` });
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO assets (
      assetId,"group",assetType,brandModel,serialNumber,assignedTo,ipAddress,macAddress,osFirmware,cpu,ram,storage,
      portDetails,powerConsumption,purchaseDate,warrantyExpiry,eol,maintenanceExpiry,cost,depreciation,residualValue,
      status,condition,usagePurpose,accessLevel,licenseKey,complianceStatus,documentation,remarks,lastAuditDate,disposedDate,replacementPlan
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  db.serialize(() => {
    list.forEach(a => {
      insert.run([
        a.assetId, a.group, a.assetType, a.brandModel, a.serialNumber, a.assignedTo, a.ipAddress, a.macAddress, a.osFirmware, a.cpu, a.ram, a.storage,
        a.portDetails, a.powerConsumption, a.purchaseDate, a.warrantyExpiry, a.eol, a.maintenanceExpiry, a.cost, a.depreciation, a.residualValue,
        a.status, a.condition, a.usagePurpose, a.accessLevel, a.licenseKey, a.complianceStatus, a.documentation, a.remarks, a.lastAuditDate, a.disposedDate, a.replacementPlan
      ]);
      db.run(`INSERT OR IGNORE INTO used_ids (assetId) VALUES (?)`, [a.assetId]);
    });
  });

  insert.finalize((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ inserted: list.length });
  });
});

// Update asset (including ID change) — transactional when ID changes
app.put('/assets/:id', (req, res) => {
  const asset = req.body;
  const oldId = req.params.id;
  const newId = asset.assetId;

  if (!asset || Object.keys(asset).length === 0) {
    return res.status(400).json({ error: 'No data provided for update' });
  }
  const missing = requireMinimalFields(asset);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const fields = Object.keys(asset).map(f => (f === 'group' ? `"group"` : f));
  const placeholders = fields.map(() => '?').join(',');

  if (oldId !== newId) {
    db.serialize(() => {
      db.run('BEGIN');
      db.run(`DELETE FROM assets WHERE assetId = ?`, oldId, function (err) {
        if (err) return rollback(err, res);

        const sqlInsert = `INSERT INTO assets (${fields.join(',')}) VALUES (${placeholders})`;
        db.run(sqlInsert, Object.values(asset), function (err2) {
          if (err2) return rollback(err2, res);

          db.run(`INSERT OR IGNORE INTO used_ids (assetId) VALUES (?)`, [asset.assetId], function (err3) {
            if (err3) return rollback(err3, res);

            db.run('COMMIT', () => res.json({ updated: 1 }));
          });
        });
      });
    });
  } else {
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

// Force delete by assetId, macAddress, or ipAddress
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

// Generate next unique ID (non-reserving)
app.get('/assets/next-id/:type', (req, res) => {
  const rawType = req.params.type;

  if (!rawType || rawType.length < 2) {
    return res.status(400).json({ error: 'Invalid asset type' });
  }

  const safePrefix = rawType
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);

  if (!safePrefix) {
    return res.status(400).json({ error: 'Invalid asset type prefix' });
  }

  db.all(`SELECT assetId FROM used_ids WHERE assetId LIKE '${safePrefix}-%'`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const numbers = rows
      .map(row => {
        const match = row.assetId.match(new RegExp(`^${safePrefix}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(n => n !== null);

    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    const id = `${safePrefix}-${String(next).padStart(3, '0')}`;

    res.json({ id });
  });
});

// --- New: scan via Python (dry-run, returns JSON list)
app.post('/scan', (req, res) => {
  const target = (req.body?.target || '').trim();
  if (!target) return res.status(400).send('Target is required');

  const PY = process.env.PYTHON || 'python'; // or 'python3'
  const script = path.join(__dirname, 'scanner.py'); // ensure scanner.py sits next to index.js

  const args = [
    script,
    '--target', target,
    '--api-url', `http://localhost:${PORT}`,
    '--dry-run',
    '--json'
  ];

  const child = spawn(PY, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let out = '', err = '';
  child.stdout.on('data', d => (out += d.toString()));
  child.stderr.on('data', d => (err += d.toString()));
  child.on('close', (code) => {
    if (code !== 0) return res.status(500).send(err || `Scanner exited with ${code}`);
    try {
      const list = JSON.parse(out);
      return res.json(Array.isArray(list) ? list : []);
    } catch {
      return res.status(500).send('Invalid scanner output');
    }
  });
});

// Streaming scan (SSE)
app.get('/scan/stream', (req, res) => {
  const target = (req.query.target || '').trim();
  if (!target) return res.status(400).end('Target is required');

  const PY = process.env.PYTHON || 'python'; // or full path
  const script = path.join(__dirname, 'scanner.py');
  const args = [script, '--target', target, '--api-url', `http://localhost:${PORT}`, '--dry-run', '--json'];

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const child = spawn(PY, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let out = '';

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${data}\n\n`);
  };

  // Optional: heartbeat to keep some proxies from closing the stream
  const keepAlive = setInterval(() => {
    res.write(':\n\n');
  }, 20000);

  child.stderr.on('data', (d) => {
    // Each line is a log line from scanner.py
    String(d).split(/\r?\n/).forEach((line) => {
      if (line.trim()) send('log', line.trim());
    });
  });

  child.stdout.on('data', (d) => {
    out += d.toString();
  });

  child.on('close', (code) => {
    clearInterval(keepAlive);
    if (code !== 0) {
      send('error', `Scanner exited with code ${code}`);
      return res.end();
    }
    try {
      const list = JSON.parse(out || '[]');
      send('result', JSON.stringify(list));
    } catch (e) {
      send('error', `Invalid JSON: ${e.message}`);
    }
    res.end();
  });

  req.on('close', () => {
    clearInterval(keepAlive);
    try { child.kill(); } catch {}
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT} (listening on 0.0.0.0)`);
});
