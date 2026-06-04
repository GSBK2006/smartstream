import React, { useState } from 'react';
import { Upload, ShieldCheck, AlertCircle } from 'lucide-react';

export default function DatasetComparator({ backendUrl, username }) {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [statsA, setStatsA] = useState(null);
  const [statsB, setStatsB] = useState(null);
  const [reportA, setReportA] = useState(null);
  const [reportB, setReportB] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'staged' | 'compared'

  const handleUpload = async (file, target) => {
    if (!file) return;
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', target);
    formData.append('username', username);

    try {
      if (target === 'A') {
        setFileA(file);
        setStatsA(null);
      } else {
        setFileB(file);
        setStatsB(null);
      }

      const res = await fetch(`${backendUrl}/api/upload-raw`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        if (target === 'A') {
          setStatsA(data.stats);
        } else {
          setStatsB(data.stats);
        }
        setStatus('staged');
      } else {
        setError(data.error || `Failed to upload dataset ${target}`);
      }
    } catch (err) {
      setError("Connection to backend server failed.");
    }
  };

  const handleCompare = async () => {
    if (!statsA || !statsB) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (res.ok) {
        setReportA(data.reportA);
        setReportB(data.reportB);
        setStatus('compared');
      } else {
        setError(data.error || "Processing failed");
      }
    } catch (err) {
      setError("Pipeline process call failed.");
    } finally {
      setLoading(false);
    }
  };

  const calculateCleanScore = (stats) => {
    if (!stats) return 0;
    const nullsCount = Object.values(stats.nulls).reduce((a, b) => a + b, 0);
    const totalCells = stats.row_count * stats.column_count;
    const missingPct = totalCells > 0 ? (nullsCount / totalCells) * 100 : 0;
    const duplicatePct = stats.row_count > 0 ? (stats.duplicates / stats.row_count) * 100 : 0;
    return Math.max(0, Math.min(100, Math.round(100 - (missingPct + duplicatePct * 1.5))));
  };

  const scoreA = statsA ? calculateCleanScore(statsA) : 0;
  const scoreB = statsB ? calculateCleanScore(statsB) : 0;

  const getVerdict = () => {
    if (scoreA > scoreB) {
      return {
        text: `Dataset 1 has a higher Integrity Score (${scoreA}% vs ${scoreB}%) and is recommended for production usage.`,
        class: 'badge-success'
      };
    } else if (scoreB > scoreA) {
      return {
        text: `Dataset 2 has a higher Integrity Score (${scoreB}% vs ${scoreA}%) and is recommended for production usage.`,
        class: 'badge-success'
      };
    } else {
      return {
        text: `Both datasets share an identical Clean Score of ${scoreA}%.`,
        class: 'badge-primary'
      };
    }
  };

  return (
    <div className="main-content-panel animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', gap: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      
      {/* Description Header */}
      <div className="glass-panel glow-purple" style={{ padding: '1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>Dataset Quality Comparator</h2>
        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '0.25rem', maxWidth: '600px', margin: '0.25rem auto 0' }}>
          Upload two separate datasets side-by-side to compare missing values, duplicate rates, schema formats, and determine the cleaner dataset.
        </p>
      </div>

      {/* Two Upload Dropzones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Dropzone A */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary))' }} />
            Dataset 1 (Baseline / Reference)
          </h3>
          <div 
            style={{
              border: '2px dashed hsl(var(--border-light))',
              borderRadius: 'var(--radius-md)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all var(--transition-normal)'
            }}
            onClick={() => document.getElementById('compare-upload-a').click()}
          >
            <input 
              id="compare-upload-a" 
              type="file" 
              accept=".csv,.json" 
              onChange={(e) => handleUpload(e.target.files[0], 'A')}
              style={{ display: 'none' }}
            />
            <Upload size={28} style={{ color: 'hsl(var(--text-muted))', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              {fileA ? fileA.name : 'Select Dataset 1'}
            </p>
            {statsA && (
              <p style={{ fontSize: '0.7rem', color: 'hsl(var(--success))', marginTop: '0.25rem' }}>
                Staged: {statsA.row_count} rows
              </p>
            )}
          </div>
        </div>

        {/* Dropzone B */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'hsl(var(--accent-purple))' }} />
            Dataset 2 (Target / Stream)
          </h3>
          <div 
            style={{
              border: '2px dashed hsl(var(--border-light))',
              borderRadius: 'var(--radius-md)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all var(--transition-normal)'
            }}
            onClick={() => document.getElementById('compare-upload-b').click()}
          >
            <input 
              id="compare-upload-b" 
              type="file" 
              accept=".csv,.json" 
              onChange={(e) => handleUpload(e.target.files[0], 'B')}
              style={{ display: 'none' }}
            />
            <Upload size={28} style={{ color: 'hsl(var(--text-muted))', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              {fileB ? fileB.name : 'Select Dataset 2'}
            </p>
            {statsB && (
              <p style={{ fontSize: '0.7rem', color: 'hsl(var(--success))', marginTop: '0.25rem' }}>
                Staged: {statsB.row_count} rows
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Compare Action Button - Text Only */}
      {statsA && statsB && status !== 'compared' && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleCompare} 
            disabled={loading}
            className="btn-primary btn-gradient animate-pulse-glow"
            style={{ padding: '0.75rem 2.5rem', fontSize: '0.95rem', borderRadius: 'var(--radius-md)' }}
          >
            {loading ? 'Comparing datasets...' : 'Compare Clean Scores'}
          </button>
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'hsl(var(--danger) / 0.1)',
          border: '1px solid hsl(var(--danger) / 0.3)',
          color: 'hsl(var(--danger))',
          fontSize: '0.8rem'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Comparison Dashboard results */}
      {status === 'compared' && statsA && statsB && (
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <h3 style={{ fontSize: '1.15rem', fontFamily: 'var(--font-display)', borderBottom: '1px solid hsl(var(--border-light))', paddingBottom: '0.5rem' }}>
            Analysis Verdict
          </h3>

          {/* Verdict Box */}
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'hsl(var(--primary-glow))',
            border: '1px solid hsl(var(--primary) / 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <ShieldCheck size={28} style={{ color: 'hsl(var(--success))', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                Pipeline Recommendation
              </div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '0.15rem' }}>
                {getVerdict().text}
              </div>
            </div>
          </div>

          {/* Clean Score Comparisons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '0.5rem 0' }}>
            
            {/* Score A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>Dataset 1: {fileA?.name || 'File 1'}</span>
                <span style={{ color: 'hsl(var(--primary))' }}>{scoreA}% Clean Score</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'hsl(var(--border-light))', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${scoreA}%`, backgroundColor: 'hsl(var(--primary))', height: '100%' }}></div>
              </div>
            </div>

            {/* Score B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>Dataset 2: {fileB?.name || 'File 2'}</span>
                <span style={{ color: 'hsl(var(--accent-purple))' }}>{scoreB}% Clean Score</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'hsl(var(--border-light))', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${scoreB}%`, backgroundColor: 'hsl(var(--accent-purple))', height: '100%' }}></div>
              </div>
            </div>

          </div>

          {/* Metrics side-by-side grid */}
          <div className="custom-table-wrapper">
            <table className="custom-table" style={{ textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Data Health Metric</th>
                  <th>Dataset 1 (Baseline)</th>
                  <th>Dataset 2 (Target)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>Clean Score</td>
                  <td style={{ color: scoreA >= scoreB ? 'hsl(var(--success))' : 'inherit', fontWeight: scoreA >= scoreB ? 700 : 'normal' }}>{scoreA}%</td>
                  <td style={{ color: scoreB >= scoreA ? 'hsl(var(--success))' : 'inherit', fontWeight: scoreB >= scoreA ? 700 : 'normal' }}>{scoreB}%</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>Total Rows</td>
                  <td>{statsA.row_count}</td>
                  <td>{statsB.row_count}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>Duplicate Rows Detected</td>
                  <td style={{ color: statsA.duplicates > 0 ? 'hsl(var(--danger))' : 'inherit' }}>{statsA.duplicates}</td>
                  <td style={{ color: statsB.duplicates > 0 ? 'hsl(var(--danger))' : 'inherit' }}>{statsB.duplicates}</td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>Missing / Null Fields</td>
                  <td style={{ color: Object.values(statsA.nulls).reduce((a,b)=>a+b, 0) > 0 ? 'hsl(var(--warning))' : 'inherit' }}>
                    {Object.values(statsA.nulls).reduce((a, b) => a + b, 0)}
                  </td>
                  <td style={{ color: Object.values(statsB.nulls).reduce((a,b)=>a+b, 0) > 0 ? 'hsl(var(--warning))' : 'inherit' }}>
                    {Object.values(statsB.nulls).reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', fontWeight: 600 }}>ML Anomalies Flagged</td>
                  <td>{reportA ? reportA.stats.anomaly_count : '—'}</td>
                  <td>{reportB ? reportB.stats.anomaly_count : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
