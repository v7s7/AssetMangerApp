// src/App.js
import React, { useState } from 'react';
import AssetTable from './components/AssetTable';
import AssetForm from './components/AssetForm';
import ScanModal from './components/ScanModal';

function App() {
  const [refresh, setRefresh] = useState(Date.now());
  const [view, setView] = useState('table'); // 'table' | 'form'
  const [scanOpen, setScanOpen] = useState(false);
  const [editData, setEditData] = useState(null); // null = add, object = edit (form view)

  // For inline edit inside the table header back button
  const [editMode, setEditMode] = useState(false);     // true when table is in inline edit
  const [editBackSignal, setEditBackSignal] = useState(0); // timestamp signal to tell table to exit edit

  const goToTable = () => {
    setView('table');
    setEditData(null);
  };

  const goToFormAdd = () => {
    setEditData(null);
    setView('form');
  };

  // If someday you want to open edit in the standalone form instead of inline:
  const goToFormEdit = (asset) => {
    setEditData(asset);
    setView('form');
  };

  const triggerRefresh = () => {
    setRefresh(Date.now());
    goToTable(); // back after save/delete
  };

  const handleImportedFromScan = () => {
    setScanOpen(false);
    setRefresh(Date.now()); // reload table after import
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center' }}>IT Asset Manager</h1>

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
            // onEdit={goToFormEdit}
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
    </div>
  );
}

export default App;
