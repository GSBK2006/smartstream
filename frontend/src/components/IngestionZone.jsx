import React, { useState } from 'react';
import { Upload, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

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

    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', 'A');
    formData.append('username', username);

    try {
      const res = await fetch(`${backendUrl}/api/upload-raw`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`"${file.name}" staged successfully! Ready to clean.`);
        onDataStaged(data.stats, 'A', 'uploaded');
      } else {
        setError(data.error || "Failed to stage custom file");
      }
    } catch (err) {
      setError("Backend connection failed. Is Flask running?");
    } finally {
      setLoading(false);
    }
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
