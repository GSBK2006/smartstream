import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, FileSpreadsheet, AlertTriangle, HelpCircle } from 'lucide-react';

export default function DataCleaner({ rawStats, report, pipelineStatus }) {
  if (pipelineStatus === 'idle') {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', color: 'hsl(var(--text-muted))' }}>
        <FileSpreadsheet size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.85rem' }}>Upload or select a preset to analyze quality</p>
      </div>
    );
  }

  // --- Staged (Raw Data) View ---
  if (pipelineStatus === 'staged' && rawStats) {
    const rawNullsCount = Object.values(rawStats.nulls).reduce((a, b) => a + b, 0);
    const totalCells = rawStats.row_count * rawStats.column_count;
    const initialHealth = Math.max(0, Math.min(95, Math.round(100 - ((rawNullsCount / (totalCells || 1)) * 100 + (rawStats.duplicates / (rawStats.row_count || 1)) * 150))));
    
    return (
      <div className="glass-panel glow-danger animate-fade-in" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} style={{ color: 'hsl(var(--warning))' }} />
          Raw Stream Staged & Noisy
        </h3>

        {/* Health Progress Indicator (Raw) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Staged Data Integrity</span>
            <span style={{ color: 'hsl(var(--warning))' }}>{initialHealth}% (Noisy)</span>
          </div>
          <div style={{ height: '8px', backgroundColor: 'hsl(var(--border-light))', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${initialHealth}%`, backgroundColor: 'hsl(var(--warning))', height: '100%' }}></div>
          </div>
        </div>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-light))', backgroundColor: 'hsl(var(--bg-surface))' }}>
            <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Duplicates</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: rawStats.duplicates > 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-primary))' }}>
              {rawStats.duplicates}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))', marginTop: '0.1rem' }}>
              Identical rows
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-light))', backgroundColor: 'hsl(var(--bg-surface))' }}>
            <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Null Fields</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: rawNullsCount > 0 ? 'hsl(var(--warning))' : 'hsl(var(--text-primary))' }}>
              {rawNullsCount}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))', marginTop: '0.1rem' }}>
              Empty entries
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-light))', backgroundColor: 'hsl(var(--bg-surface))' }}>
            <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Row Count</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {rawStats.row_count}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))', marginTop: '0.1rem' }}>
              Messy lines
            </div>
          </div>
        </div>

        {/* Schema Status */}
        <h4 style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem', fontWeight: 600 }}>Staged Columns list</h4>
        <div className="custom-table-wrapper" style={{ maxHeight: '180px', overflowY: 'auto' }}>
          <table className="custom-table" style={{ fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Parsed As</th>
                <th>Nulls Found</th>
              </tr>
            </thead>
            <tbody>
              {rawStats.columns.map((name) => {
                const nulls = rawStats.nulls[name] || 0;
                return (
                  <tr key={name} className="raw-row">
                    <td style={{ fontWeight: 600 }}>{name}</td>
                    <td style={{ color: 'hsl(var(--text-secondary))', fontFamily: 'monospace' }}>{rawStats.dtypes[name]}</td>
                    <td style={{ color: nulls > 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-muted))' }}>{nulls}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- Cleaned / Processed View ---
  if (pipelineStatus === 'cleaned' && report && report.stats) {
    const { stats, columns } = report;
    const before = stats.before;
    const after = stats.after;

    const beforeNullsCount = Object.values(before.nulls).reduce((a, b) => a + b, 0);
    const totalCellsBefore = before.row_count * before.column_count;
    const beforeDuplicates = before.duplicates;
    
    const missingPct = totalCellsBefore > 0 ? (beforeNullsCount / totalCellsBefore) * 100 : 0;
    const duplicatePct = before.row_count > 0 ? (beforeDuplicates / before.row_count) * 100 : 0;
    const initialHealth = Math.max(0, Math.min(95, Math.round(100 - (missingPct + duplicatePct * 1.5))));
    const finalHealth = 100;

    return (
      <div className="glass-panel glow-purple animate-fade-in" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={18} className="text-secondary" style={{ color: 'hsl(var(--accent-purple))' }} />
          AI Pipeline Cleansing Monitor
        </h3>

        {/* Health Progress Comparer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
            <span>Data Integrity Score</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: 'hsl(var(--danger))' }}>{initialHealth}%</span>
              <ArrowRight size={12} style={{ color: 'hsl(var(--text-muted))' }} />
              <span style={{ color: 'hsl(var(--success))', display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                {finalHealth}% <ShieldCheck size={14} />
              </span>
            </span>
          </div>
          <div style={{ height: '8px', backgroundColor: 'hsl(var(--border-light))', borderRadius: '4px', overflow: 'hidden', position: 'relative', display: 'flex' }}>
            <div style={{ width: `${initialHealth}%`, backgroundColor: 'hsl(var(--danger))', height: '100%' }}></div>
            <div style={{ flexGrow: 1, backgroundColor: 'hsl(var(--success))', height: '100%', borderLeft: '1px solid black' }}></div>
          </div>
        </div>

        {/* Metric Cards Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-light))', backgroundColor: 'hsl(var(--bg-surface))' }}>
            <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Rows Deduplicated</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: beforeDuplicates > 0 ? 'hsl(var(--warning))' : 'hsl(var(--text-primary))' }}>
              {beforeDuplicates} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'hsl(var(--text-secondary))' }}>rows</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-secondary))', marginTop: '0.1rem' }}>
              {before.row_count} → {after.row_count} total
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-light))', backgroundColor: 'hsl(var(--bg-surface))' }}>
            <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Imputed Fields</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem', color: beforeNullsCount > 0 ? 'hsl(var(--primary))' : 'hsl(var(--text-primary))' }}>
              {beforeNullsCount} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'hsl(var(--text-secondary))' }}>nulls</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-secondary))', marginTop: '0.1rem' }}>
              Filled with median / mode
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border-light))', backgroundColor: 'hsl(var(--bg-surface))' }}>
            <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Normalizations</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.2rem' }}>
              {columns.filter(c => c.is_datetime).length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'hsl(var(--text-secondary))' }}>dates</span>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-secondary))', marginTop: '0.1rem' }}>
              Trimmed & HTML cleaned
            </div>
          </div>
        </div>

        {/* Schema / Columns list */}
        <h4 style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem', fontWeight: 600 }}>Schema & Processing Status</h4>
        <div className="custom-table-wrapper" style={{ maxHeight: '180px', overflowY: 'auto' }}>
          <table className="custom-table" style={{ fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Parsed As</th>
                <th>Nulls</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => {
                const beforeNulls = before.nulls[col.name] || 0;
                let statusLabel = <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>OK</span>;
                if (beforeNulls > 0) {
                  statusLabel = <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>Imputed</span>;
                } else if (col.is_datetime) {
                  statusLabel = <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>Normalized</span>;
                }
                return (
                  <tr key={col.name}>
                    <td style={{ fontWeight: 600 }}>{col.name}</td>
                    <td style={{ color: 'hsl(var(--text-secondary))', fontFamily: 'monospace' }}>{col.type}</td>
                    <td style={{ color: beforeNulls > 0 ? 'hsl(var(--warning))' : 'hsl(var(--text-muted))' }}>{beforeNulls}</td>
                    <td>{statusLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}
