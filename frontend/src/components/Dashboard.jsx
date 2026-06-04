import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Activity, ShieldAlert, Table, SlidersHorizontal, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Dashboard({ rawStats, report, pipelineStatus, onProcess, processing, onRedirectToCompare }) {
  const [selectedYCol, setSelectedYCol] = useState('');
  const [selectedXCol, setSelectedXCol] = useState('');
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState(false);
  const [isCompareView, setIsCompareView] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const itemsPerPage = 6;

  const { data = [], columns = [], stats = {} } = report || {};

  // Setup default charting columns
  useEffect(() => {
    if (columns.length > 0) {
      const numCols = columns.filter(c => c.is_numerical && c.name !== 'rating');
      if (numCols.length > 0) {
        setSelectedYCol(numCols[0].name);
      } else {
        setSelectedYCol(columns[0].name);
      }

      const dtCols = columns.filter(c => c.is_datetime);
      if (dtCols.length > 0) {
        setSelectedXCol(dtCols[0].name);
      } else {
        const tCol = columns.find(c => ['timestamp', 'created_at', 'created', 'time', 'date'].includes(c.name.toLowerCase()));
        if (tCol) {
          setSelectedXCol(tCol.name);
        } else {
          setSelectedXCol('');
        }
      }
    }
  }, [columns]);

  if (pipelineStatus === 'idle') {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'hsl(var(--text-muted))' }}>
        <Activity size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
        <h4 style={{ fontFamily: 'var(--font-display)', color: 'hsl(var(--text-secondary))', marginBottom: '0.25rem' }}>Awaiting Operational Stream</h4>
        <p style={{ fontSize: '0.85rem' }}>Upload raw files or choose a simulation preset to launch the dashboard.</p>
      </div>
    );
  }

  // --- Staged (Raw Data Preview) View ---
  if (pipelineStatus === 'staged' && rawStats) {
    const rawData = rawStats.sample || [];
    const totalPages = Math.ceil(rawData.length / itemsPerPage);
    const paginatedRaw = rawData.slice((tablePage - 1) * itemsPerPage, tablePage * itemsPerPage);

    const rawNullsCount = Object.values(rawStats.nulls).reduce((a, b) => a + b, 0);
    const isPreCleaned = rawStats.duplicates === 0 && rawNullsCount === 0;

    return (
      <div className="main-content-panel animate-fade-in">
        {/* Processing Banner */}
        <div 
          className="glass-panel animate-pulse-glow" 
          style={{ 
            padding: '1.5rem 2rem', 
            textAlign: 'center', 
            border: isPreCleaned ? '1px dashed hsl(var(--success))' : '1px dashed hsl(var(--warning))', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '0.75rem' 
          }}
        >
          {isPreCleaned ? (
            <CheckCircle2 size={28} style={{ color: 'hsl(var(--success))' }} />
          ) : (
            <AlertTriangle size={28} style={{ color: 'hsl(var(--warning))' }} />
          )}
          
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', marginBottom: '0.2rem' }}>
              {isPreCleaned ? 'Clean Stream Data Staged' : 'Noisy Stream Telemetry Staged'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
              {isPreCleaned ? (
                "Nice! This dataset contains 0 duplicates and 0 missing values. Click below to run the AI anomaly detector and generate insights."
              ) : (
                `Detected **${rawStats.duplicates} duplicates** and **${rawNullsCount} missing values** in the raw stream. Execute pipeline cleaning to compare datasets.`
              )}
            </p>
          </div>
          
          {/* Button with no icon */}
          <button 
            onClick={onProcess} 
            disabled={processing}
            className="btn-gradient animate-pulse-glow"
            style={{ padding: '0.6rem 1.6rem', fontSize: '0.85rem', borderRadius: 'var(--radius-md)' }}
          >
            {processing ? 'Scanning Anomalies...' : (isPreCleaned ? 'Run Anomaly Scan' : 'Process & Clean Data')}
          </button>
        </div>

        {/* Raw Log Preview */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Table size={16} style={{ color: isPreCleaned ? 'hsl(var(--success))' : 'hsl(var(--warning))' }} />
            {isPreCleaned ? 'Staged Data Log (Clean)' : 'Raw Ingested Records (Preview)'}
          </h3>
          <div className="custom-table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  {rawStats.columns.slice(0, 5).map(colName => (
                    <th key={colName}>{colName}</th>
                  ))}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRaw.map((row, idx) => {
                  const rowIndex = (tablePage - 1) * itemsPerPage + idx;
                  let hasNull = false;
                  rawStats.columns.slice(0, 5).forEach(col => {
                    if (row[col] === '' || row[col] === null || row[col] === undefined) hasNull = true;
                  });
                  
                  return (
                    <tr key={rowIndex} className="raw-row" style={{ opacity: 0.85 }}>
                      <td style={{ fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{rowIndex + 1}</td>
                      {rawStats.columns.slice(0, 5).map(col => {
                        const val = row[col];
                        const isNull = val === '' || val === null || val === undefined;
                        return (
                          <td 
                            key={col} 
                            style={{ 
                              color: isNull ? 'hsl(var(--danger))' : 'hsl(var(--text-primary))',
                              fontStyle: isNull ? 'italic' : 'normal',
                              fontWeight: isNull ? 600 : 'normal'
                            }}
                          >
                            {isNull ? 'NULL' : String(val)}
                          </td>
                        );
                      })}
                      <td>
                        {hasNull ? (
                          <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>Missing</span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>Staged</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem' }}>
              <span style={{ color: 'hsl(var(--text-secondary))' }}>
                Showing {Math.min(rawData.length, (tablePage - 1) * itemsPerPage + 1)} to {Math.min(rawData.length, tablePage * itemsPerPage)} of {rawData.length} lines
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setTablePage(p => Math.max(1, p - 1))} 
                  disabled={tablePage === 1}
                  className="btn-secondary"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem' }}
                >
                  Prev
                </button>
                <button 
                  onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} 
                  disabled={tablePage === totalPages}
                  className="btn-secondary"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Cleaned Dashboard View ---
  const filteredData = showOnlyAnomalies 
    ? data.filter(d => d.is_anomaly)
    : data;

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((tablePage - 1) * itemsPerPage, tablePage * itemsPerPage);

  const rawSampleData = (rawStats && rawStats.sample) ? rawStats.sample.slice((tablePage - 1) * itemsPerPage, tablePage * itemsPerPage) : [];

  const chartData = data.map((d, index) => ({
    ...d,
    chartX: selectedXCol ? d[selectedXCol] : index,
    chartY: Number(d[selectedYCol]) || 0
  }));

  const anomalyDots = chartData.filter(d => d.is_anomaly);

  const CustomChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const record = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'hsl(var(--bg-panel))',
          border: '1px solid hsl(var(--border-light))',
          padding: '0.6rem 0.8rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.75rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
        }}>
          <p style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
            {selectedXCol ? `${selectedXCol}: ${record[selectedXCol]}` : `Index: ${record.chartX}`}
          </p>
          <p style={{ color: 'hsl(var(--primary))', marginTop: '0.2rem' }}>
            {selectedYCol}: <strong style={{ fontSize: '0.85rem' }}>{record.chartY.toFixed(2)}</strong>
          </p>
          {record.is_anomaly && (
            <p style={{ color: 'hsl(var(--danger))', marginTop: '0.4rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', borderTop: '1px solid hsl(var(--border-light))', paddingTop: '0.3rem' }}>
              <AlertTriangle size={12} /> Outlier: {record.anomaly_reason}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="main-content-panel animate-fade-in">
      
      {/* Visual Header / Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>Ingested Streams</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.1rem', color: 'hsl(var(--text-primary))' }}>
            {data.length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'hsl(var(--text-muted))' }}>events</span>
          </div>
        </div>

        <div className="glass-panel glow-danger" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>Anomaly Flags</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.1rem', color: stats.anomaly_count > 0 ? 'hsl(var(--danger))' : 'hsl(var(--success))' }}>
            {stats.anomaly_count} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'hsl(var(--text-muted))' }}>events</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase' }}>Active Columns</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.1rem' }}>
            {columns.length} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'hsl(var(--text-muted))' }}>fields</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.1rem', color: stats.anomaly_count > 0 ? 'hsl(var(--warning))' : 'hsl(var(--success))' }}>
            {((stats.anomaly_count / data.length) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Main Metric Chart */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={16} style={{ color: 'hsl(var(--primary))' }} />
            Pipeline Waveform & Outlier Monitor
          </h3>
          
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <SlidersHorizontal size={12} style={{ color: 'hsl(var(--text-muted))' }} />
            <select 
              value={selectedYCol} 
              onChange={(e) => setSelectedYCol(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            >
              {columns.filter(c => c.is_numerical).map(c => (
                <option key={c.name} value={c.name}>Y: {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ width: '100%', height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border-light))" strokeDasharray="3 3" />
              <XAxis 
                dataKey="chartX" 
                stroke="hsl(var(--text-muted))" 
                fontSize={9} 
                tickLine={false}
                tickFormatter={(val) => {
                  if (typeof val === 'string' && val.length > 15) {
                    return val.split(' ')[1] || val.substring(0, 10);
                  }
                  return val;
                }}
              />
              <YAxis stroke="hsl(var(--text-muted))" fontSize={9} tickLine={false} />
              <Tooltip content={<CustomChartTooltip />} />
              <Area 
                type="monotone" 
                dataKey="chartY" 
                stroke="hsl(var(--primary))" 
                strokeWidth={1.5}
                fillOpacity={1} 
                fill="url(#colorY)" 
              />
              
              {anomalyDots.map((dot, idx) => (
                <ReferenceDot 
                  key={idx}
                  x={dot.chartX}
                  y={dot.chartY}
                  r={5}
                  fill="hsl(var(--danger))"
                  stroke="#fff"
                  strokeWidth={1.2}
                  style={{ cursor: 'pointer', filter: 'drop-shadow(0 0 3px hsl(var(--danger)))' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Compare Dataset & Cleaned Telemetry Log */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Table size={16} style={{ color: 'hsl(var(--accent-purple))' }} />
            {isCompareView ? 'Noisy Raw vs. Cleaned Dataset Comparison' : 'Ingested Records & Telemetry Log'}
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            {/* Compare Toggle Button - Text Only */}
            {rawStats && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => { setIsCompareView(!isCompareView); setShowOnlyAnomalies(false); setTablePage(1); }}
                  className={isCompareView ? 'btn btn-primary' : 'btn btn-secondary'}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                >
                  {isCompareView ? 'Exit Comparison' : 'Compare Raw vs Cleaned'}
                </button>
                <button 
                  onClick={onRedirectToCompare}
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                >
                  Compare Datasets
                </button>
              </div>
            )}

            {!isCompareView && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showOnlyAnomalies} 
                  onChange={(e) => { setShowOnlyAnomalies(e.target.checked); setTablePage(1); }}
                  style={{ cursor: 'pointer' }}
                />
                Show Anomalies Only
              </label>
            )}
          </div>
        </div>

        {isCompareView ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            
            {/* Raw Table */}
            <div>
              <h4 style={{ fontSize: '0.75rem', color: 'hsl(var(--warning))', marginBottom: '0.4rem', fontWeight: 600 }}>Noisy Raw Stream</h4>
              <div className="custom-table-wrapper">
                <table className="custom-table" style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      {rawStats.columns.slice(0, 3).map(c => <th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rawSampleData.map((row, idx) => {
                      const rowIndex = (tablePage - 1) * itemsPerPage + idx;
                      return (
                        <tr key={rowIndex} className="raw-row">
                          <td style={{ fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{rowIndex + 1}</td>
                          {rawStats.columns.slice(0, 3).map(col => {
                            const val = row[col];
                            const isNull = val === '' || val === null || val === undefined;
                            return (
                              <td key={col} style={{ color: isNull ? 'hsl(var(--danger))' : 'inherit', fontStyle: isNull ? 'italic' : 'normal' }}>
                                {isNull ? 'NULL' : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cleaned Table */}
            <div>
              <h4 style={{ fontSize: '0.75rem', color: 'hsl(var(--success))', marginBottom: '0.4rem', fontWeight: 600 }}>Cleaned & Imputed Output</h4>
              <div className="custom-table-wrapper">
                <table className="custom-table" style={{ fontSize: '0.75rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      {columns.slice(0, 3).map(c => <th key={c.name}>{c.name}</th>)}
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row, idx) => {
                      const rowIndex = (tablePage - 1) * itemsPerPage + idx;
                      return (
                        <tr key={rowIndex} className={row.is_anomaly ? 'anomaly-row' : ''}>
                          <td style={{ fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{rowIndex + 1}</td>
                          {columns.slice(0, 3).map(c => {
                            let val = row[c.name];
                            if (typeof val === 'number') val = val.toFixed(2);
                            return <td key={c.name}>{val !== null && val !== undefined ? String(val) : '—'}</td>;
                          })}
                          <td>
                            {row.is_anomaly ? (
                              <span className="badge badge-danger" style={{ fontSize: '0.55rem', padding: '0.1rem 0.25rem' }}>Alert</span>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: '0.55rem', padding: '0.1rem 0.25rem' }}>Clean</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="custom-table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  {columns.filter(c => c.name !== 'anomaly_reason').slice(0, 5).map(c => (
                    <th key={c.name}>{c.name}</th>
                  ))}
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, idx) => {
                  const rowIndex = (tablePage - 1) * itemsPerPage + idx;
                  return (
                    <tr key={rowIndex} className={row.is_anomaly ? 'anomaly-row' : ''}>
                      <td style={{ fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{rowIndex + 1}</td>
                      {columns.filter(c => c.name !== 'anomaly_reason').slice(0, 5).map(c => {
                        let val = row[c.name];
                        if (typeof val === 'number') {
                          val = val.toFixed(2);
                        }
                        return <td key={c.name}>{val !== null && val !== undefined ? String(val) : '—'}</td>;
                      })}
                      <td>
                        {row.is_anomaly ? (
                          <span className="badge badge-danger" title={row.anomaly_reason} style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <AlertTriangle size={10} /> Anomaly
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Cleaned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'hsl(var(--text-secondary))' }}>
              Showing {Math.min(filteredData.length, (tablePage - 1) * itemsPerPage + 1)} to {Math.min(filteredData.length, tablePage * itemsPerPage)} of {filteredData.length} records
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setTablePage(p => Math.max(1, p - 1))} 
                disabled={tablePage === 1}
                className="btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem' }}
              >
                Prev
              </button>
              <button 
                onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} 
                disabled={tablePage === totalPages}
                className="btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.7rem' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
