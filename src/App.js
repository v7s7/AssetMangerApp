import React, { useState } from 'react';
import AssetTable from './components/AssetTable';
import AssetForm from './components/AssetForm';

function App() {
  const [refresh, setRefresh] = useState(Date.now());
  const [view, setView] = useState('table'); // 'table' or 'form'

  const triggerRefresh = () => {
    setRefresh(Date.now());
    setView('table'); // go back after save
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center' }}>IT Asset Manager</h1>

      {view === 'table' && (
        <>
          <div style={{ textAlign: 'right', marginBottom: '20px' }}>
            <button onClick={() => setView('form')} style={{ padding: '8px 16px' }}>
              Add New Asset
            </button>
          </div>
          <AssetTable refreshSignal={refresh} />
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
