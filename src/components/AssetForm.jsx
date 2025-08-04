import React, { useState, useEffect } from 'react';
import {
  addAsset,
  updateAsset,
  getNextAssetId
} from '../utils/api';
import { groups } from '../data/groups';
import { categories } from '../data/categories';

export default function AssetForm({ onSave, editData }) {
  const isEdit = !!editData;
  const [formData, setFormData] = useState(null);
  const [originalId, setOriginalId] = useState(null);

  useEffect(() => {
    if (isEdit) {
      setFormData(editData);
      setOriginalId(editData.assetId);
    } else {
      const init = async () => {
const newId = await getNextAssetId('General');
        setFormData({
          assetId: newId,
          group: '',
          assetType: '',
          brandModel: '',
          serialNumber: '',
          assignedTo: '',
          ipAddress: '',
          macAddress: '',
          osFirmware: '',
          cpu: '',
          ram: '',
          storage: '',
          portDetails: '',
          powerConsumption: '',
          purchaseDate: '',
          warrantyExpiry: '',
          eol: '',
          maintenanceExpiry: '',
          cost: '',
          depreciation: '',
          residualValue: '',
          status: '',
          condition: '',
          usagePurpose: '',
          accessLevel: '',
          licenseKey: '',
          complianceStatus: '',
          documentation: '',
          remarks: '',
          lastAuditDate: '',
          disposedDate: '',
          replacementPlan: ''
        });
      };
      init();
    }
  }, [editData, isEdit]);

  const handleChange = async (e) => {
    const { name, value } = e.target;

    if (name === 'assetType') {
      try {
        const newId = await getNextAssetId(value);
        setFormData((prev) => ({
          ...prev,
          assetType: value,
          assetId: newId
        }));
      } catch (err) {
        alert('Failed to generate asset ID: ' + err.message);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateAsset(formData, originalId || formData.assetId);
        alert('Asset updated');
      } else {
        await addAsset(formData);
        alert('Asset added');
      }
      if (onSave) onSave();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (!formData) return <p>Loading form...</p>;

  const sections = [
    {
      title: 'Basic Info',
      fields: ['assetId', 'group', 'assetType', 'brandModel', 'serialNumber', 'assignedTo']
    },
    {
      title: 'Technical Details',
      fields: ['ipAddress', 'macAddress', 'osFirmware', 'cpu', 'ram', 'storage', 'portDetails', 'powerConsumption']
    },
    {
      title: 'Lifecycle Info',
      fields: ['purchaseDate', 'warrantyExpiry', 'eol', 'maintenanceExpiry']
    },
    {
      title: 'Financial Info',
      fields: ['cost', 'depreciation', 'residualValue']
    },
    {
      title: 'Status & Usage',
      fields: ['status', 'condition', 'usagePurpose', 'accessLevel']
    },
    {
      title: 'Compliance & Documentation',
      fields: ['licenseKey', 'complianceStatus', 'documentation']
    },
    {
      title: 'Additional Info',
      fields: ['remarks', 'lastAuditDate', 'disposedDate', 'replacementPlan']
    }
  ];

  const numericFields = ['ram', 'storage', 'powerConsumption', 'cost', 'depreciation', 'residualValue'];

  return (
    <form onSubmit={handleSubmit} style={formContainer}>
      <h2 style={formHeader}>{isEdit ? 'Edit Asset' : 'Add New Asset'}</h2>

      {sections.map((section) => (
        <fieldset key={section.title} style={fieldsetStyle}>
          <legend style={legendStyle}>{section.title}</legend>
          {section.fields.map((field) => {
            const isDate = field.toLowerCase().includes('date');
            const isTextArea = ['remarks', 'documentation'].includes(field);
            const isGroup = field === 'group';
            const isAssetType = field === 'assetType';
            const isNumeric = numericFields.includes(field);

            const label = field.charAt(0).toUpperCase() +
              field.slice(1).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');

            return (
              <div key={field} style={fieldRow}>
                <label style={labelStyle}>{label}:</label>

                {isGroup ? (
                  <select
                    name="group"
                    value={formData.group}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    {groups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : isAssetType ? (
                  <select
                    name="assetType"
                    value={formData.assetType}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="">Select</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : isTextArea ? (
                  <textarea
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    rows="3"
                    style={inputStyle}
                  />
                ) : (
                  <input
                    type={isDate ? 'date' : isNumeric ? 'number' : 'text'}
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                )}
              </div>
            );
          })}
        </fieldset>
      ))}

      <div style={{ textAlign: 'center' }}>
        <button type="submit" style={submitButtonStyle}>
          {isEdit ? 'Update Asset' : 'Save Asset'}
        </button>
      </div>
    </form>
  );
}

// === Styles ===
const formContainer = {
  maxWidth: '900px',
  margin: '0 auto',
  background: '#fff',
  padding: '25px',
  borderRadius: '10px',
  boxShadow: '0 0 10px rgba(0,0,0,0.08)'
};

const formHeader = {
  textAlign: 'center',
  marginBottom: '30px',
  fontSize: '24px',
  color: '#333'
};

const fieldsetStyle = {
  marginBottom: '25px',
  padding: '15px',
  border: '1px solid #ccc',
  borderRadius: '6px'
};

const legendStyle = {
  fontWeight: 'bold',
  fontSize: '16px',
  padding: '0 10px'
};

const fieldRow = {
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '12px'
};

const labelStyle = {
  marginBottom: '4px',
  fontWeight: '500'
};

const inputStyle = {
  padding: '8px',
  fontSize: '14px',
  borderRadius: '4px',
  border: '1px solid #ccc'
};

const submitButtonStyle = {
  marginTop: '20px',
  padding: '10px 20px',
  fontSize: '16px',
  background: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer'
};
