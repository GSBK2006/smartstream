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

  if (numericCols.length > 0 && records.length > 0) {
    const n = records.length;
    const d = numericCols.length;
    
    // Build feature matrix X
    const X = [];
    for (let i = 0; i < n; i++) {
      const rowVals = [];
      for (let j = 0; j < d; j++) {
        const col = numericCols[j];
        const val = Number(records[i][col]);
        rowVals.push(isNaN(val) ? 0.0 : val);
      }
      X.push(rowVals);
    }

    // Standardize features (Z-score Scaling)
    const means = [];
    const stdDevs = [];
    for (let j = 0; j < d; j++) {
      const colVals = X.map(row => row[j]);
      const mean = colVals.reduce((a, b) => a + b, 0) / n;
      const variance = colVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n > 1 ? n - 1 : 1);
      const stdDev = Math.sqrt(variance);
      means.push(mean);
      stdDevs.push(stdDev);
    }

    const X_scaled = [];
    for (let i = 0; i < n; i++) {
      const scaledRow = [];
      for (let j = 0; j < d; j++) {
        const val = X[i][j];
        const mean = means[j];
        const stdDev = stdDevs[j];
        scaledRow.push(stdDev > 0 ? (val - mean) / stdDev : 0.0);
      }
      X_scaled.push(scaledRow);
    }

    // Method A: Z-score detection flags
    const zFlags = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < d; j++) {
        if (Math.abs(X_scaled[i][j]) > 3.0) {
          zFlags[i] = 1;
          break;
        }
      }
    }

    // Method B: Isolation Forest flags (contamination = 7%)
    const isoFlags = runIsolationForest(X_scaled, 100, 0.07);

    // Method C: DBSCAN flags (eps = 0.8, minSamples = 8)
    const dbFlags = runDbscan(X_scaled, 0.8, 8);

    // Ensemble Voting (agreed by >= 2 methods)
    for (let i = 0; i < n; i++) {
      const votes = zFlags[i] + isoFlags[i] + dbFlags[i];
      if (votes >= 2) {
        records[i].is_anomaly = true;
        const methods = [];
        if (zFlags[i] === 1) methods.push("Z-score");
        if (isoFlags[i] === 1) methods.push("Isolation Forest");
        if (dbFlags[i] === 1) methods.push("DBSCAN");
        records[i].anomaly_reason = `Ensemble outlier confirmed by ${votes}/3 methods (${methods.join(', ')}).`;
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

// ============================================================================
// ENSEMBLE ANOMALY DETECTORS (PURE JAVASCRIPT IMPLEMENTATIONS)
// ============================================================================

function c_factor(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
}

class IsolationTree {
  constructor() {
    this.splitFeature = null;
    this.splitValue = null;
    this.left = null;
    this.right = null;
    this.size = 0;
  }

  fit(X, depth, maxDepth) {
    this.size = X.length;
    if (X.length <= 1 || depth >= maxDepth) {
      return;
    }

    const numFeatures = X[0].length;
    const fIdx = Math.floor(Math.random() * numFeatures);
    this.splitFeature = fIdx;

    let min = X[0][fIdx];
    let max = X[0][fIdx];
    for (let i = 1; i < X.length; i++) {
      if (X[i][fIdx] < min) min = X[i][fIdx];
      if (X[i][fIdx] > max) max = X[i][fIdx];
    }

    if (min === max) {
      return;
    }

    const splitVal = min + Math.random() * (max - min);
    this.splitValue = splitVal;

    const leftX = [];
    const rightX = [];
    for (let i = 0; i < X.length; i++) {
      if (X[i][fIdx] < splitVal) {
        leftX.push(X[i]);
      } else {
        rightX.push(X[i]);
      }
    }

    this.left = new IsolationTree();
    this.left.fit(leftX, depth + 1, maxDepth);

    this.right = new IsolationTree();
    this.right.fit(rightX, depth + 1, maxDepth);
  }

  pathLength(x, currentDepth) {
    if (this.left === null || this.right === null) {
      return currentDepth + c_factor(this.size);
    }
    if (x[this.splitFeature] < this.splitValue) {
      return this.left.pathLength(x, currentDepth + 1);
    } else {
      return this.right.pathLength(x, currentDepth + 1);
    }
  }
}

function runDbscan(X_scaled, eps = 0.8, minSamples = 8) {
  const n = X_scaled.length;
  if (n === 0) return new Array(0).fill(0);
  const labels = new Array(n).fill(0); // 0 = unvisited
  let clusterId = 0;

  function getNeighbors(i) {
    const neighbors = [];
    const pi = X_scaled[i];
    for (let j = 0; j < n; j++) {
      const pj = X_scaled[j];
      let distSq = 0;
      for (let d = 0; d < pi.length; d++) {
        distSq += Math.pow(pi[d] - pj[d], 2);
      }
      if (Math.sqrt(distSq) <= eps) {
        neighbors.push(j);
      }
    }
    return neighbors;
  }

  function expandCluster(i, neighbors, clusterId) {
    labels[i] = clusterId;
    const queue = [...neighbors];
    for (let q = 0; q < queue.length; q++) {
      const neighborIdx = queue[q];
      if (labels[neighborIdx] === -1) {
        labels[neighborIdx] = clusterId;
      }
      if (labels[neighborIdx] !== 0) continue;

      labels[neighborIdx] = clusterId;
      const nextNeighbors = getNeighbors(neighborIdx);
      if (nextNeighbors.length >= minSamples) {
        for (let nn = 0; nn < nextNeighbors.length; nn++) {
          if (!queue.includes(nextNeighbors[nn])) {
            queue.push(nextNeighbors[nn]);
          }
        }
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== 0) continue;

    const neighbors = getNeighbors(i);
    if (neighbors.length < minSamples) {
      labels[i] = -1; // noise
    } else {
      clusterId++;
      expandCluster(i, neighbors, clusterId);
    }
  }

  return labels.map(l => (l === -1 ? 1 : 0));
}

function runIsolationForest(X_scaled, nEstimators = 100, contamination = 0.07) {
  const n = X_scaled.length;
  if (n === 0) return new Array(0).fill(0);
  
  const sampleSize = Math.min(256, n);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, sampleSize)));
  const trees = [];

  for (let i = 0; i < nEstimators; i++) {
    const sample = [];
    const indices = new Set();
    while (indices.size < sampleSize) {
      indices.add(Math.floor(Math.random() * n));
    }
    for (const idx of indices) {
      sample.push(X_scaled[idx]);
    }

    const tree = new IsolationTree();
    tree.fit(sample, 0, maxDepth);
    trees.push(tree);
  }

  const scores = [];
  const cVal = c_factor(sampleSize);
  
  for (let i = 0; i < n; i++) {
    let totalPathLength = 0;
    for (let t = 0; t < nEstimators; t++) {
      totalPathLength += trees[t].pathLength(X_scaled[i], 0);
    }
    const avgPathLength = totalPathLength / nEstimators;
    const score = cVal > 0 ? Math.pow(2, -avgPathLength / cVal) : 0.5;
    scores.push({ idx: i, score });
  }

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const cutoffIdx = Math.floor(n * contamination);
  const flaggedIndices = new Set(sorted.slice(0, cutoffIdx).map(item => item.idx));

  const flags = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (flaggedIndices.has(i)) {
      flags[i] = 1;
    }
  }
  return flags;
}
