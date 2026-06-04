function parseDatetime(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function isNumericCol(records, col) {
  let hasValues = false;
  for (const r of records) {
    const val = r[col];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      if (isNaN(Number(val))) {
        return false;
      }
      hasValues = true;
    }
  }
  return hasValues;
}

function isDatetimeCol(records, col) {
  const colLower = col.toLowerCase();
  if (!['time', 'date', 'created', 'updated', 'logged'].some(k => colLower.includes(k))) {
    return false;
  }
  
  let hasValues = false;
  for (const r of records) {
    const val = r[col];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      const dt = parseDatetime(val);
      if (dt !== null) {
        hasValues = true;
      } else {
        return false;
      }
    }
  }
  return hasValues;
}

function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) {
    return sorted[Math.floor(n / 2)];
  } else {
    return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  }
}

function calculateMode(values) {
  if (values.length === 0) return 'Unknown';
  const counts = {};
  let maxCount = 0;
  let modeVal = 'Unknown';
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      modeVal = v;
    }
  }
  return modeVal;
}

export function cleanAndProcessData(recordsInput) {
  if (!recordsInput || recordsInput.length === 0) {
    return {
      cleaned: [],
      report: {
        stats: {
          before: { row_count: 0, column_count: 0, duplicates: 0, nulls: {} },
          after: { row_count: 0, column_count: 0, duplicates: 0, nulls: {} }
        },
        data: [],
        anomalies: [],
        columns: []
      }
    };
  }

  // Deep copy
  let records = recordsInput.map(r => ({ ...r }));
  const totalRowsBefore = records.length;
  const columns = Object.keys(records[0]);

  // Deduplication
  const seen = new Set();
  const dedupedRecords = [];
  let duplicatesCount = 0;
  
  for (const r of records) {
    const sortedKeysValues = Object.keys(r).sort().map(k => `${k}:${r[k]}`).join('|');
    if (seen.has(sortedKeysValues)) {
      duplicatesCount++;
    } else {
      seen.add(sortedKeysValues);
      dedupedRecords.push(r);
    }
  }
  records = dedupedRecords;

  // Initial null counts & clean HTML/whitespace
  const nullsBefore = {};
  const dtypesBefore = {};
  const colTypes = {};
  
  for (const col of columns) {
    nullsBefore[col] = 0;
    dtypesBefore[col] = 'object';
  }

  for (const r of records) {
    for (const col of columns) {
      let val = r[col];
      if (val === undefined || val === null || String(val).trim() === "" || String(val).toLowerCase() === "nan" || String(val).toLowerCase() === "null" || String(val).toLowerCase() === "none") {
        r[col] = null;
        nullsBefore[col]++;
      } else {
        // Simple HTML unescaping
        let cleanedVal = String(val)
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .trim();
        if (cleanedVal === "" || cleanedVal.toLowerCase() === "nan" || cleanedVal.toLowerCase() === "null" || cleanedVal.toLowerCase() === "none") {
          r[col] = null;
          nullsBefore[col]++;
        } else {
          r[col] = cleanedVal;
        }
      }
    }
  }

  // Detect column types
  for (const col of columns) {
    if (isNumericCol(records, col)) {
      colTypes[col] = 'numeric';
      dtypesBefore[col] = 'float64';
    } else if (isDatetimeCol(records, col)) {
      colTypes[col] = 'datetime';
      dtypesBefore[col] = 'datetime64[ns]';
    } else {
      colTypes[col] = 'categorical';
      dtypesBefore[col] = 'object';
    }
  }

  // Impute missing values
  for (const col of columns) {
    const type = colTypes[col];
    
    if (type === 'numeric') {
      const numericVals = [];
      for (const r of records) {
        if (r[col] !== null) {
          const num = Number(r[col]);
          if (!isNaN(num)) numericVals.push(num);
        }
      }
      const medianVal = calculateMedian(numericVals);
      
      for (const r of records) {
        if (r[col] === null) {
          r[col] = medianVal;
        } else {
          r[col] = Number(r[col]);
        }
      }
    } else if (type === 'datetime') {
      // Ffill
      let lastValid = null;
      for (const r of records) {
        if (r[col] !== null) {
          const dt = parseDatetime(r[col]);
          if (dt) lastValid = dt.toISOString().replace('T', ' ').substring(0, 19);
        }
        if (r[col] === null && lastValid !== null) {
          r[col] = lastValid;
        }
      }
      // Bfill
      lastValid = null;
      for (let i = records.length - 1; i >= 0; i--) {
        const r = records[i];
        if (r[col] !== null) {
          const dt = parseDatetime(r[col]);
          if (dt) lastValid = dt.toISOString().replace('T', ' ').substring(0, 19);
        }
        if (r[col] === null && lastValid !== null) {
          r[col] = lastValid;
        }
      }
      // Default fallback
      const fallbackNow = new Date().toISOString().replace('T', ' ').substring(0, 19);
      for (const r of records) {
        if (r[col] === null) {
          r[col] = fallbackNow;
        } else {
          const dt = parseDatetime(r[col]);
          if (dt) r[col] = dt.toISOString().replace('T', ' ').substring(0, 19);
        }
      }
    } else { // categorical
      const catVals = [];
      for (const r of records) {
        if (r[col] !== null) catVals.push(String(r[col]));
      }
      const modeVal = calculateMode(catVals);
      for (const r of records) {
        if (r[col] === null) {
          r[col] = modeVal;
        }
      }
    }
  }

  // Anomaly checks
  for (const r of records) {
    r.is_anomaly = false;
    r.anomaly_reason = "";
  }

  const anomalies = [];
  const numericCols = columns.filter(col => colTypes[col] === 'numeric' && col !== 'rating');

  for (const col of numericCols) {
    const vals = records.map(r => Number(r[col]));
    const n = vals.length;
    if (n > 1) {
      const mean = vals.reduce((a, b) => a + b, 0) / n;
      const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        for (let idx = 0; idx < records.length; idx++) {
          const r = records[idx];
          const val = Number(r[col]);
          const zScore = (val - mean) / stdDev;
          if (Math.abs(zScore) > 3.0) {
            r.is_anomaly = true;
            const reason = `Outlier in ${col}: value ${val.toFixed(1)} (Z-score: ${zScore.toFixed(1)})`;
            r.anomaly_reason = r.anomaly_reason ? `${r.anomaly_reason} | ${reason}` : reason;
          }
        }
      }
    }
  }

  // Explicit rating bound check
  if (columns.includes('rating')) {
    for (let idx = 0; idx < records.length; idx++) {
      const r = records[idx];
      const val = r.rating;
      if (val !== null) {
        const fVal = Number(val);
        if (isNaN(fVal) || fVal < 1.0 || fVal > 5.0) {
          r.is_anomaly = true;
          const reason = `Out-of-bounds rating: ${val} (expected 1 to 5)`;
          r.anomaly_reason = r.anomaly_reason ? `${r.anomaly_reason} | ${reason}` : reason;
        }
      }
    }
  }

  // Extract anomalies
  for (let idx = 0; idx < records.length; idx++) {
    const r = records[idx];
    if (r.is_anomaly) {
      anomalies.push({
        row_index: idx,
        data: { ...r },
        reason: r.anomaly_reason
      });
    }
  }

  const report = {
    stats: {
      before: {
        row_count: totalRowsBefore,
        column_count: columns.length,
        duplicates: duplicatesCount,
        nulls: nullsBefore,
        dtypes: dtypesBefore
      },
      after: {
        row_count: records.length,
        column_count: columns.length,
        duplicates: 0,
        nulls: columns.reduce((acc, col) => ({ ...acc, [col]: 0 }), {}),
        dtypes: columns.reduce((acc, col) => ({
          ...acc,
          [col]: colTypes[col] === 'numeric' ? 'float64' : (colTypes[col] === 'datetime' ? 'datetime64[ns]' : 'object')
        }), {})
      },
      anomaly_count: anomalies.length
    },
    data: records,
    anomalies: anomalies,
    columns: columns.map(col => ({
      name: col,
      type: colTypes[col] === 'numeric' ? 'float64' : (colTypes[col] === 'datetime' ? 'datetime64[ns]' : 'object'),
      is_numerical: colTypes[col] === 'numeric',
      is_datetime: colTypes[col] === 'datetime',
      is_anomaly_candidate: colTypes[col] === 'numeric' && col !== 'rating'
    }))
  };

  return { cleaned: records, report };
}
