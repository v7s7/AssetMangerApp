import React, { useState } from 'react';
import AssetTable from './components/AssetTable';
import AssetForm from './components/AssetForm';
import ScanModal from './components/ScanModal';

function App() {
  const [refresh, setRefresh] = useState(Date.now());
  const [view, setView] = useState('table'); // 'table' or 'form'
  const [scanOpen, setScanOpen] = useState(false);

  const triggerRefresh = () => {
    setRefresh(Date.now());
    setView('table'); // go back after save
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 20 }}>
            <button onClick={() => setScanOpen(true)} style={{ padding: '8px 16px' }}>
              Scan Network
            </button>
            <button onClick={() => setView('form')} style={{ padding: '8px 16px' }}>
              Add New Asset
            </button>
          </div>

          <AssetTable refreshSignal={refresh} />

          <ScanModal
            isOpen={scanOpen}
            onClose={() => setScanOpen(false)}
            onImported={handleImportedFromScan}
          />
        </>
      )}

      {view === 'form' && (
        <div>
          <button onClick={() => setView('table')} style={{ marginBottom: '20px' }}>
            ← Back to List
          </button>
          <AssetForm onSave={triggerRefresh} />
        </div>
      )}
    </div>
  );
}

export default App;
