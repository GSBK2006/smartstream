import React, { useState } from 'react';
import { Upload, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { saveStagedData } from '../utils/supabaseClient';

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = [];
    let insideQuote = false;
    let currentVal = "";
    
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' || char === "'") {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentVal.trim());
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());
    
    const record = {};
    for (let h = 0; h < headers.length; h++) {
      let val = values[h] !== undefined ? values[h].replace(/^["']|["']$/g, '') : "";
      record[headers[h]] = val;
    }
    records.push(record);
  }
  return records;
}

function getRawStats(records) {
  if (!records || records.length === 0) {
    return {
      row_count: 0,
      column_count: 0,
      duplicates: 0,
      nulls: {},
      dtypes: {},
      columns: [],
      sample: []
    };
  }
  
  const columns = Object.keys(records[0]);
  const seen = new Set();
  let duplicates = 0;
  for (const r of records) {
    const serialized = Object.keys(r).sort().map(k => `${k}:${r[k]}`).join('|');
    if (seen.has(serialized)) {
      duplicates++;
    } else {
      seen.add(serialized);
    }
  }
  
  const nulls = {};
  for (const col of columns) nulls[col] = 0;
  for (const r of records) {
    for (const col of columns) {
      const val = r[col];
      if (val === undefined || val === null || String(val).trim() === "" || String(val).toLowerCase() === "nan" || String(val).toLowerCase() === "null") {
        nulls[col]++;
      }
    }
  }
  
  const dtypes = {};
  for (const col of columns) {
    let isNum = true;
    for (const r of records) {
      const val = r[col];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        if (isNaN(Number(val))) {
          isNum = false;
          break;
        }
      }
    }
    dtypes[col] = isNum ? 'float64' : 'object';
  }
  
  return {
    row_count: records.length,
    column_count: columns.length,
    duplicates,
    nulls,
    dtypes,
    columns,
    sample: records.slice(0, 15)
  };
}

export default function IngestionZone({ onDataStaged, backendUrl, onReset, username }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (file) => {
    if (!file) return;
    const isCsvOrJson = file.name.endsWith('.csv') || file.name.endsWith('.json');
    if (!isCsvOrJson) {
      setError("Please upload only CSV or JSON files.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        let records = [];
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          records = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          records = parseCSV(text);
        }
        
        const stats = getRawStats(records);
        
        // Save to Supabase staged_data directly
        const saveRes = await saveStagedData(username, 'A', records, stats, null, null);
        if (saveRes.success) {
          setSuccessMsg(`"${file.name}" staged successfully! Ready to clean.`);
          onDataStaged(stats, 'A', 'uploaded');
        } else {
          setError(saveRes.message || "Failed to stage data in database.");
        }
      } catch (err) {
        setError(`Parsing failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError("Failed to read file.");
      setLoading(false);
    };
    
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleResetClick = () => {
    setError(null);
    setSuccessMsg('');
    onReset();
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Database size={16} className="text-primary" style={{ color: 'hsl(var(--primary))' }} />
        Ingestion Source
      </h3>
      
      {/* Drag & Drop Area */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => dragOver && setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'hsl(var(--primary))' : 'hsl(var(--border-light))'}`,
          borderRadius: 'var(--radius-md)',
          padding: '2.5rem 1rem',
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: dragOver ? 'hsl(var(--primary-glow))' : 'transparent',
          transition: 'all var(--transition-normal)',
          marginBottom: '1rem'
        }}
        onClick={() => !loading && document.getElementById('file-upload-input').click()}
      >
        <input 
          id="file-upload-input" 
          type="file" 
          accept=".csv,.json" 
          onChange={(e) => handleFileUpload(e.target.files[0])}
          style={{ display: 'none' }}
          disabled={loading}
        />
        <Upload size={24} style={{ color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem' }} />
        <p style={{ fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.15rem' }}>
          {loading ? 'Uploading and staging...' : 'Drag & drop operational CSV/JSON'}
        </p>
        <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
          Supports CSV and JSON file formats
        </p>
      </div>

      {/* Reset button */}
      <button 
        onClick={handleResetClick} 
        disabled={loading}
        className="btn-secondary"
        style={{ width: '100%', justifyContent: 'center', padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
      >
        Clear Pipeline Streams
      </button>

      {/* Error & Success Messages */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.6rem 0.8rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'hsl(var(--danger) / 0.1)',
          border: '1px solid hsl(var(--danger) / 0.25)',
          color: 'hsl(var(--danger))',
          fontSize: '0.75rem',
          marginTop: '0.75rem'
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.6rem 0.8rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'hsl(var(--success) / 0.1)',
          border: '1px solid hsl(var(--success) / 0.25)',
          color: 'hsl(var(--success))',
          fontSize: '0.75rem',
          marginTop: '0.75rem'
        }}>
          <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
