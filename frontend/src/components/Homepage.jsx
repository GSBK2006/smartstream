import React, { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Activity, ShieldCheck, Database, Award, Info } from 'lucide-react';

export default function Homepage({ report, onNavigate, username }) {

  // Compute metrics dynamically from processed report
  const fingerprintData = useMemo(() => {
    if (!report || !report.data || report.data.length === 0) {
      // Mock / Preview Data for empty state
      return {
        integrityScore: 78,
        radar: [
          { subject: 'Completeness', value: 85, fullMark: 100 },
          { subject: 'Consistency', value: 80, fullMark: 100 },
          { subject: 'Anomaly Resistance', value: 75, fullMark: 100 },
          { subject: 'Entropy Control', value: 65, fullMark: 100 },
          { subject: 'Relationship Strength', value: 70, fullMark: 100 }
        ],
        columns: [
          { name: 'timestamp', type: 'datetime' },
          { name: 'temperature', type: 'numeric' },
          { name: 'vibration', type: 'numeric' },
          { name: 'status', type: 'categorical' }
        ],
        mockSequencer: true
      };
    }

    const records = report.data;
    const columns = report.columns || [];
    const totalCells = records.length * columns.length;
    
    // 1. Completeness
    let nullCount = 0;
    for (const r of records) {
      for (const col of columns) {
        const val = r[col.name];
        if (val === null || val === undefined || String(val) === "") {
          nullCount++;
        }
      }
    }
    const completeness = totalCells > 0 ? ((totalCells - nullCount) / totalCells) * 100 : 100;

    // 2. Consistency (Type conformity)
    let consistentCells = 0;
    for (const r of records) {
      for (const col of columns) {
        const val = r[col.name];
        if (val !== null && val !== undefined && String(val) !== "") {
          if (col.is_numerical) {
            if (!isNaN(Number(val))) consistentCells++;
          } else if (col.is_datetime) {
            if (!isNaN(new Date(val).getTime())) consistentCells++;
          } else {
            consistentCells++; // Categorical is always consistent
          }
        }
      }
    }
    const consistency = totalCells > 0 ? (consistentCells / totalCells) * 100 : 100;

    // 3. Anomaly Resistance
    const anomalyCount = report.stats?.anomaly_count || 0;
    const anomalyDensity = records.length > 0 ? (anomalyCount / records.length) * 100 : 0;
    const anomalyResistance = Math.max(0, 100 - (anomalyDensity * 5)); // Penalize anomalies

    // 4. Entropy Control (Degree of order/randomness)
    // Average normalized Shannon entropy across categorical and numeric columns
    let totalEntropy = 0;
    let entropyCount = 0;
    for (const col of columns) {
      if (col.name === 'is_anomaly' || col.name === 'anomaly_reason') continue;
      const vals = records.map(r => String(r[col.name])).filter(v => v !== "");
      if (vals.length > 1) {
        const counts = {};
        for (const v of vals) counts[v] = (counts[v] || 0) + 1;
        let entropy = 0;
        for (const count of Object.values(counts)) {
          const p = count / vals.length;
          entropy -= p * Math.log2(p);
        }
        const maxEntropy = Math.log2(vals.length);
        const normEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
        totalEntropy += normEntropy;
        entropyCount++;
      }
    }
    const avgEntropy = entropyCount > 0 ? totalEntropy / entropyCount : 0.5;
    const entropyControl = (1 - avgEntropy) * 100;

    // 5. Relationship Strength (Correlation)
    // Check Pearson correlation between first two numerical columns
    const numCols = columns.filter(col => col.is_numerical && col.name !== 'rating');
    let correlationStrength = 50; // default baseline
    if (numCols.length >= 2) {
      const col1 = numCols[0].name;
      const col2 = numCols[1].name;
      const vals1 = records.map(r => Number(r[col1])).filter(v => !isNaN(v));
      const vals2 = records.map(r => Number(r[col2])).filter(v => !isNaN(v));
      const n = Math.min(vals1.length, vals2.length);
      if (n > 1) {
        const mean1 = vals1.reduce((a, b) => a + b, 0) / n;
        const mean2 = vals2.reduce((a, b) => a + b, 0) / n;
        let num = 0, den1 = 0, den2 = 0;
        for (let i = 0; i < n; i++) {
          const d1 = vals1[i] - mean1;
          const d2 = vals2[i] - mean2;
          num += d1 * d2;
          den1 += d1 * d1;
          den2 += d2 * d2;
        }
        const r = den1 === 0 || den2 === 0 ? 0 : num / Math.sqrt(den1 * den2);
        correlationStrength = Math.abs(r) * 100;
      }
    }

    // Global Integrity Index
    const integrityScore = Math.round(
      (completeness * 0.3) + 
      (consistency * 0.25) + 
      (anomalyResistance * 0.25) + 
      (entropyControl * 0.1) + 
      (correlationStrength * 0.1)
    );

    return {
      integrityScore,
      radar: [
        { subject: 'Completeness', value: Math.round(completeness), fullMark: 100 },
        { subject: 'Consistency', value: Math.round(consistency), fullMark: 100 },
        { subject: 'Anomaly Resistance', value: Math.round(anomalyResistance), fullMark: 100 },
        { subject: 'Entropy Control', value: Math.round(entropyControl), fullMark: 100 },
        { subject: 'Relationship Strength', value: Math.round(correlationStrength), fullMark: 100 }
      ],
      columns: columns.filter(col => col.name !== 'is_anomaly' && col.name !== 'anomaly_reason'),
      mockSequencer: false
    };
  }, [report]);

  // Generate column-level metrics for the heatmap matrix
  const columnMetrics = useMemo(() => {
    const cols = fingerprintData.columns;
    if (fingerprintData.mockSequencer) {
      // Return beautiful mock metrics for the 4 preview columns
      return [
        {
          name: 'timestamp',
          type: 'datetime',
          completeness: 100,
          consistency: 100,
          anomalyDensity: 0,
          correlation: null,
          entropy: 98.4,
          details: 'Standard ISO datetime sequence. Complete and consistent.'
        },
        {
          name: 'temperature',
          type: 'numeric',
          completeness: 94.2,
          consistency: 98.5,
          anomalyDensity: 4.5,
          correlation: 82.4,
          entropy: 74.1,
          details: 'Outliers detected at high boundaries (Z-score > 3.0).'
        },
        {
          name: 'vibration',
          type: 'numeric',
          completeness: 100,
          consistency: 88.0,
          anomalyDensity: 12.0,
          correlation: 82.4,
          entropy: 85.3,
          details: 'High variance and noise density in numeric distributions.'
        },
        {
          name: 'status',
          type: 'categorical',
          completeness: 85.0,
          consistency: 100,
          anomalyDensity: 1.2,
          correlation: null,
          entropy: 32.5,
          details: '15 missing/null text values. Uniform categorical labels.'
        }
      ];
    }

    const records = report.data || [];
    const totalRows = records.length;
    if (totalRows === 0) return [];

    // Identify numerical columns for Pearson correlation
    const numericCols = cols.filter(c => c.is_numerical);

    return cols.map(col => {
      const colName = col.name;
      const isNumeric = col.is_numerical;
      const isDatetime = col.is_datetime;
      const typeStr = isNumeric ? 'numeric' : (isDatetime ? 'datetime' : 'categorical');

      // 1. Completeness
      let nullCount = 0;
      for (const r of records) {
        const val = r[colName];
        if (val === null || val === undefined || String(val).trim() === "") {
          nullCount++;
        }
      }
      const completeness = totalRows > 0 ? ((totalRows - nullCount) / totalRows) * 100 : 100;

      // 2. Consistency
      let consistentCount = 0;
      let nonNullCount = 0;
      for (const r of records) {
        const val = r[colName];
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          nonNullCount++;
          if (isNumeric) {
            if (!isNaN(Number(val))) consistentCount++;
          } else if (isDatetime) {
            if (!isNaN(new Date(val).getTime())) consistentCount++;
          } else {
            consistentCount++; // Categorical is always consistent
          }
        }
      }
      const consistency = nonNullCount > 0 ? (consistentCount / nonNullCount) * 100 : 100;

      // 3. Anomaly Density
      let anomalyCount = 0;
      for (const r of records) {
        if (r.is_anomaly && String(r.anomaly_reason).includes(colName)) {
          anomalyCount++;
        }
      }
      const anomalyDensity = totalRows > 0 ? (anomalyCount / totalRows) * 100 : 0;

      // 4. Correlation Strength (Max absolute Pearson r with another numeric column)
      let maxCorrelation = null;
      if (isNumeric && numericCols.length > 1) {
        let maxR = 0;
        const valsY = records.map(r => Number(r[colName])).filter(v => !isNaN(v));
        
        for (const otherCol of numericCols) {
          if (otherCol.name === colName) continue;
          const valsX = records.map(r => Number(r[otherCol.name])).filter(v => !isNaN(v));
          
          const n = Math.min(valsX.length, valsY.length);
          if (n > 1) {
            const meanX = valsX.reduce((a, b) => a + b, 0) / n;
            const meanY = valsY.reduce((a, b) => a + b, 0) / n;
            let num = 0, denX = 0, denY = 0;
            for (let i = 0; i < n; i++) {
              const dX = valsX[i] - meanX;
              const dY = valsY[i] - meanY;
              num += dX * dY;
              denX += dX * dX;
              denY += dY * dY;
            }
            const r = denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY);
            const absR = Math.abs(r);
            if (absR > maxR) {
              maxR = absR;
            }
          }
        }
        maxCorrelation = maxR * 100;
      }

      // 5. Entropy
      const activeVals = records.map(r => String(r[colName])).filter(v => v !== "");
      let entropyPercent = 0;
      if (activeVals.length > 1) {
        const counts = {};
        for (const v of activeVals) {
          counts[v] = (counts[v] || 0) + 1;
        }
        let entropy = 0;
        for (const count of Object.values(counts)) {
          const p = count / activeVals.length;
          entropy -= p * Math.log2(p);
        }
        const maxEntropy = Math.log2(activeVals.length);
        entropyPercent = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;
      }

      // Generate brief diagnosis text
      let colDetails = '';
      if (completeness < 100) colDetails += `${nullCount} missing. `;
      if (consistency < 100) colDetails += `${nonNullCount - consistentCount} invalid type. `;
      if (anomalyCount > 0) colDetails += `${anomalyCount} anomalies. `;
      if (colDetails === '') {
        colDetails = 'Column looks clean and healthy.';
      }

      return {
        name: colName,
        type: typeStr,
        completeness,
        consistency,
        anomalyDensity,
        correlation: maxCorrelation,
        entropy: entropyPercent,
        details: colDetails.trim()
      };
    });
  }, [fingerprintData, report]);

  return (
    <div className="main-content-panel animate-fade-in" style={{ gap: '1.5rem', display: 'flex', flexDirection: 'column' }}>
      
      {/* Premium Hero Title Banner */}
      <div className="glass-panel glow-purple" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div style={{ flex: '1 1 500px' }}>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'hsl(var(--primary))',
            backgroundColor: 'hsl(var(--primary-glow))',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            border: '1px solid hsl(var(--primary) / 0.15)'
          }}>
            SYSTEM GATEWAY
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, marginTop: '0.6rem' }}>
            Data Pipeline Health Diagnostics
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '0.35rem', maxWidth: '650px', lineHeight: 1.5 }}>
            Welcome to the SmartStream control terminal. Securely ingest, clean, and verify telemetry logs, database writes, and customer metrics directly in your browser. Below is your dataset's real-time digital fingerprint.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate('dashboard')} className="btn btn-primary btn-gradient" style={{ padding: '0.6rem 1.25rem', fontSize: '0.8rem' }}>
            Open Pipeline Terminal
          </button>
          <button onClick={() => onNavigate('compare')} className="btn btn-secondary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.8rem' }}>
            Compare Datasets
          </button>
        </div>
      </div>

      {/* Diagnostics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Metric 1: Global Integrity Index */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, alignSelf: 'flex-start', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} className="text-success" />
            Global Integrity Index
          </h3>
          
          <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* SVG Progress Circle */}
            <svg style={{ transform: 'rotate(-90deg)', width: '160px', height: '160px' }}>
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="transparent"
                stroke="hsl(var(--border-light))"
                strokeWidth="8"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="transparent"
                stroke="hsl(var(--primary))"
                strokeWidth="10"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * fingerprintData.integrityScore) / 100}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dashoffset 1s ease-in-out',
                  filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.5))'
                }}
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'hsl(var(--text-primary))' }}>
                {fingerprintData.integrityScore}%
              </span>
              <span style={{ fontSize: '0.6rem', letterSpacing: '0.05em', color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', fontWeight: 700 }}>
                {fingerprintData.integrityScore > 90 ? 'Excellent' : (fingerprintData.integrityScore > 75 ? 'Healthy' : 'Degraded')}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--primary-glow))', border: '1px solid hsl(var(--primary) / 0.15)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Info size={14} className="text-primary" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
              {report 
                ? `Successfully computed from ${report.data.length} records. Clean duplicates and run anomaly flags in the pipeline page to enhance the score.` 
                : 'Showing baseline preview scanner. Upload a custom operational stream inside the pipeline page to calculate your actual dataset index.'}
            </span>
          </div>
        </div>

        {/* Metric 2: Noise Fingerprint Radar */}
        <div className="glass-panel glow-purple" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '320px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={16} className="text-primary" />
            Noise Fingerprint (5-Axis)
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>
            Graphical representation of data health across core scanning parameters.
          </p>

          <div style={{ flex: 1, width: '100%', height: '100%', minHeight: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={fingerprintData.radar}>
                <PolarGrid stroke="hsl(var(--border-light))" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: 'hsl(var(--text-secondary))', fontSize: 9, fontWeight: 500 }} 
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={{ fill: 'hsl(var(--text-muted))', fontSize: 8 }} 
                  axisLine={false}
                />
                <Radar
                  name="Health Vector"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.25}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Noise Fingerprint Heatmap Matrix */}
      <div className="glass-panel glow-purple" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={16} style={{ color: 'hsl(var(--accent-purple))' }} />
            Noise Fingerprint Heatmap Matrix
          </h3>
          <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '0.15rem' }}>
            In-depth statistical scan showing data completeness, type consistency, outlier density, correlation, and entropy per column.
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border-light))', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Column Name</th>
                <th style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, textAlign: 'center' }}>Completeness</th>
                <th style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, textAlign: 'center' }}>Consistency</th>
                <th style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, textAlign: 'center' }}>Anomaly Density</th>
                <th style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, textAlign: 'center' }}>Correlation Strength</th>
                <th style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600, textAlign: 'center' }}>Entropy</th>
                <th style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {columnMetrics.map((col, idx) => {
                // Color formatting logic
                
                // 1. Completeness
                let completenessBg = 'hsla(var(--success), 0.15)';
                let completenessColor = 'hsl(var(--success))';
                if (col.completeness < 90) {
                  completenessBg = 'hsla(var(--danger), 0.15)';
                  completenessColor = 'hsl(var(--danger))';
                } else if (col.completeness < 100) {
                  completenessBg = 'hsla(var(--warning), 0.15)';
                  completenessColor = 'hsl(var(--warning))';
                }

                // 2. Consistency
                let consistencyBg = 'hsla(var(--success), 0.15)';
                let consistencyColor = 'hsl(var(--success))';
                if (col.consistency < 90) {
                  consistencyBg = 'hsla(var(--danger), 0.15)';
                  consistencyColor = 'hsl(var(--danger))';
                } else if (col.consistency < 100) {
                  consistencyBg = 'hsla(var(--warning), 0.15)';
                  consistencyColor = 'hsl(var(--warning))';
                }

                // 3. Anomaly Density
                let anomalyBg = 'hsla(var(--success), 0.1)';
                let anomalyColor = 'hsl(var(--text-secondary))';
                if (col.anomalyDensity > 5) {
                  anomalyBg = 'hsla(var(--danger), 0.18)';
                  anomalyColor = 'hsl(var(--danger))';
                } else if (col.anomalyDensity > 0) {
                  anomalyBg = 'hsla(var(--warning), 0.12)';
                  anomalyColor = 'hsl(var(--warning))';
                }

                // 4. Correlation
                let correlationBg = 'transparent';
                let correlationColor = 'hsl(var(--text-muted))';
                let correlationText = 'N/A';
                if (col.correlation !== null) {
                  correlationText = `${col.correlation.toFixed(1)}%`;
                  if (col.correlation > 70) {
                    correlationBg = 'hsla(var(--accent-purple), 0.2)';
                    correlationColor = 'hsl(var(--accent-purple))';
                  } else if (col.correlation > 30) {
                    correlationBg = 'hsla(var(--accent-purple), 0.1)';
                    correlationColor = 'hsl(var(--accent-purple) / 0.8)';
                  } else {
                    correlationBg = 'hsla(var(--border-light), 0.2)';
                    correlationColor = 'hsl(var(--text-secondary))';
                  }
                }

                // 5. Entropy
                let entropyBg = 'hsla(200, 80%, 50%, 0.08)';
                let entropyColor = 'hsl(200, 80%, 55%)';
                if (col.entropy > 80) {
                  entropyBg = 'hsla(200, 80%, 50%, 0.22)';
                  entropyColor = 'hsl(200, 90%, 65%)';
                } else if (col.entropy > 40) {
                  entropyBg = 'hsla(200, 80%, 50%, 0.15)';
                  entropyColor = 'hsl(200, 80%, 55%)';
                }

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid hsl(var(--border-light) / 0.5)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{col.name}</span>
                        <span style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginTop: '0.15rem' }}>{col.type}</span>
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '0.35rem 0.65rem', borderRadius: '4px', backgroundColor: completenessBg, color: completenessColor, fontWeight: 600 }}>
                        {col.completeness.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '0.35rem 0.65rem', borderRadius: '4px', backgroundColor: consistencyBg, color: consistencyColor, fontWeight: 600 }}>
                        {col.consistency.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '0.35rem 0.65rem', borderRadius: '4px', backgroundColor: anomalyBg, color: anomalyColor, fontWeight: 600 }}>
                        {col.anomalyDensity.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '0.35rem 0.65rem', borderRadius: '4px', backgroundColor: correlationBg, color: correlationColor, fontWeight: 600 }}>
                        {correlationText}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '0.35rem 0.65rem', borderRadius: '4px', backgroundColor: entropyBg, color: entropyColor, fontWeight: 600 }}>
                        {col.entropy.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: 'hsl(var(--text-secondary))', fontSize: '0.75rem' }}>
                      {col.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
