// src/App.js
import React, { useEffect, useState } from 'react';
import AssetTable from './components/AssetTable';
import AssetForm from './components/AssetForm';
import ScanModal from './components/ScanModal';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import { authMe, logout } from './utils/api';

function App() {
  // Auth
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await authMe();
        setUser(user);
      } catch {
        setUser(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  // App view state
  const [refresh, setRefresh] = useState(Date.now());
  const [view, setView] = useState('table'); // 'table' | 'form' | 'dashboard'
  const [scanOpen, setScanOpen] = useState(false);
  const [editData, setEditData] = useState(null); // null = add, object = edit (form view)

  // Inline edit coordination with table
  const [editMode, setEditMode] = useState(false);         // true when table is in inline edit
  const [editBackSignal, setEditBackSignal] = useState(0); // timestamp to tell table to exit edit

  // Navigation helpers
  const goToTable = () => {
    setView('table');
    setEditData(null);
  };
  const goToFormAdd = () => {
    setEditData(null);
    setView('form');
  };
  const goToDashboard = () => setView('dashboard');

  const triggerRefresh = () => {
    setRefresh(Date.now());
    goToTable(); // back after save/delete
  };

  const handleImportedFromScan = () => {
    setScanOpen(false);
    setRefresh(Date.now()); // reload table after import
  };

  // Auth gating
  if (checking) {
    return <div style={{ padding: 20 }}>Loading…</div>;
  }
  if (!user) {
    return <LoginPage onLoggedIn={setUser} />;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header with user + logout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>IT Asset Manager</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#555', fontSize: 14 }}>{user?.name || user?.email}</span>
          <button
            onClick={async () => { await logout(); setUser(null); }}
            style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>

      {view === 'table' && (
        <>
          {/* Top toolbar on table view:
              - Left: Back to List ONLY when inline editing is active
              - Right: actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            <div>
              {editMode && (
                <button
                  onClick={() => setEditBackSignal(Date.now())}
                  style={{ padding: '8px 16px' }}
                >
                  ← Back to List
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setScanOpen(true)} style={{ padding: '8px 16px' }}>
                Scan Network
              </button>
              <button onClick={goToDashboard} style={{ padding: '8px 16px' }}>
                Dashboard
              </button>
              <button onClick={goToFormAdd} style={{ padding: '8px 16px' }}>
                Add New Asset
              </button>
            </div>
          </div>

          <AssetTable
            refreshSignal={refresh}
            // Coordinate inline edit state with the header Back button
            onEditStart={() => setEditMode(true)}
            onEditEnd={() => setEditMode(false)}
            backSignal={editBackSignal}
            // If you ever want to edit in the standalone form instead of inline, you can also pass:
            // onEdit={(asset) => { setEditData(asset); setView('form'); }}
          />

          <ScanModal
            isOpen={scanOpen}
            onClose={() => setScanOpen(false)}
            onImported={handleImportedFromScan}
          />
        </>
      )}

      {view === 'form' && (
        <>
          {/* Top toolbar on form view:
              - Left: Back to List
              - Right: empty to mirror layout */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            <div>
              <button onClick={goToTable} style={{ padding: '8px 16px' }}>
                ← Back to List
              </button>
            </div>
            <div />
          </div>

          <AssetForm
            editData={editData}           // null => add, object => edit
            onSave={triggerRefresh}       // after save, refresh + back
            onCancel={goToTable}          // back without saving
            onDeleted={triggerRefresh}    // after delete, refresh + back
          />
        </>
      )}

      {view === 'dashboard' && (
        <>
          {/* Top toolbar on dashboard view:
              - Left: Back to List
              - Right: empty to mirror layout */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            <div>
              <button onClick={goToTable} style={{ padding: '8px 16px' }}>
                ← Back to List
              </button>
            </div>
            <div />
          </div>

          <Dashboard />
        </>
      )}
    </div>
  );
}

export default App;
