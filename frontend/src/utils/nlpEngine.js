function isNumericVal(v) {
  return typeof v === 'number' && !isNaN(v);
}

function isNumericList(values) {
  if (values.length === 0) return false;
  return values.every(v => isNumericVal(v));
}

function isDatetimeStr(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (s.length >= 10 && ((s[4] === '-' && s[7] === '-') || (s[4] === '/' && s[7] === '/'))) {
    return true;
  }
  return false;
}

export function generateOfflineSummary(records, anomaliesCount) {
  if (!records || records.length === 0) return "No data processed yet.";
  
  const columns = Object.keys(records[0]);
  let summary = "### Pipeline Insights & Execution Summary (Offline Engine)\n\n";
  summary += `- Dataset Health: Processing completed. Checked ${records.length} rows. Cleaned duplicated rows and resolved missing values.\n`;
  summary += `- Anomaly Count: Found ${anomaliesCount} anomalous events across the dataset.\n\n`;
  
  summary += "#### Key Column Breakdown:\n";
  for (const col of columns) {
    if (['is_anomaly', 'anomaly_reason'].includes(col)) continue;
    
    const vals = records.map(r => r[col]).filter(v => v !== null && v !== undefined);
    const numericVals = vals.map(v => Number(v)).filter(v => !isNaN(v));
    
    // Check if the original column type is numerical (all values are numbers)
    const isNum = vals.length > 0 && vals.every(v => typeof v === 'number');
    
    if (isNum) {
      const meanVal = numericVals.reduce((a, b) => a + b, 0) / numericVals.length;
      const maxVal = Math.max(...numericVals);
      const minVal = Math.min(...numericVals);
      summary += `- ${col}: Numerical. Average is ${meanVal.toFixed(2)} (Range: ${minVal.toFixed(2)} to ${maxVal.toFixed(2)}).\n`;
    } else if (vals.some(v => isDatetimeStr(v))) {
      summary += `- ${col}: Chronological timeline parsed.\n`;
    } else {
      // Categorical
      const nonEmpty = vals.map(v => String(v)).filter(s => s !== "");
      if (nonEmpty.length > 0) {
        const counts = {};
        for (const v of nonEmpty) {
          counts[v] = (counts[v] || 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const countsStr = sorted.map(([k, v]) => `'${k}': ${v}`).join(", ");
        summary += `- ${col}: Categorical. Primary distributions: ${countsStr}.\n`;
      }
    }
  }
  
  if (anomaliesCount > 0) {
    summary += "\n#### Detected Anomalies:\n";
    let count = 0;
    for (let idx = 0; idx < records.length; idx++) {
      const r = records[idx];
      if (String(r.is_anomaly).toLowerCase() === 'true' || r.is_anomaly === 1 || r.is_anomaly === true) {
        const reason = r.anomaly_reason || 'Threshold exceeded';
        summary += `- Row ${idx}: ${reason}\n`;
        count++;
        if (count >= 5) break;
      }
    }
  }
  
  return summary;
}

export function runOfflineQA(records, question, chatHistory = []) {
  if (!records || records.length === 0) return "No data processed yet.";
  
  let q = question.toLowerCase().trim();
  const columns = Object.keys(records[0]);
  
  const anomIndices = [];
  for (let idx = 0; idx < records.length; idx++) {
    const isAnom = String(records[idx].is_anomaly).toLowerCase() === 'true' || records[idx].is_anomaly === 1 || records[idx].is_anomaly === true;
    if (isAnom) {
      anomIndices.push(idx);
    }
  }
  const anomCount = anomIndices.length;

  // Contextual parsing for conversational flow
  let hasAnomalyContext = false;
  let activeCol = null;

  for (const msg of chatHistory.slice(-3)) {
    const text = String(msg.text).toLowerCase();
    if (['anomaly', 'anomalies', 'outlier', 'outliers', 'flagged', 'flag', 'spike', 'spikes', 'jump', 'jumps'].some(k => text.includes(k))) {
      hasAnomalyContext = true;
    }
    for (const col of columns) {
      if (['is_anomaly', 'anomaly_reason'].includes(col)) continue;
      if (text.includes(col.toLowerCase())) {
        activeCol = col;
      }
    }
  }

  if (hasAnomalyContext && ['why', 'explain', 'reason', 'detail', 'details', 'them', 'show', 'spikes', 'spike'].some(k => q.includes(k))) {
    if (!['anomaly', 'anomalies', 'outlier', 'outliers', 'flagged', 'flag'].some(k => q.includes(k))) {
      q += " anomalies";
    }
  }

  if (activeCol && ['average', 'mean', 'avg', 'maximum', 'max', 'highest', 'peak', 'minimum', 'min', 'lowest', 'sum', 'total'].some(k => q.includes(k))) {
    if (!columns.some(col => col !== 'is_anomaly' && col !== 'anomaly_reason' && q.includes(col.toLowerCase()))) {
      q += ` ${activeCol.toLowerCase()}`;
    }
  }

  // 1. Anomalies queries
  if (['anomaly', 'anomalies', 'outlier', 'outliers', 'flagged', 'flag', 'spike', 'spikes', 'jump', 'jumps'].some(k => q.includes(k))) {
    if (['why', 'reason', 'explain', 'detail', 'details'].some(k => q.includes(k))) {
      if (anomCount === 0) return "No anomalies were detected in the dataset.";
      let response = `Here are the explanations for the detected anomalies (Total: ${anomCount}):\n\n`;
      let shown = 0;
      for (const idx of anomIndices) {
        const reason = records[idx].anomaly_reason || 'Threshold exceeded';
        response += `- Row ${idx}: ${reason}\n`;
        shown++;
        if (shown >= 10) break;
      }
      if (anomCount > 10) {
        response += `\n(Showing first 10 of ${anomCount} anomalies)`;
      }
      return response;
    } else {
      return `There are ${anomCount} anomalies detected in the dataset. You can view them highlighted on the dashboard or query details about them by asking 'why did it spike?' or 'explain anomalies'.`;
    }
  }

  // 2. Aggregations (average, max, min, mean, sum)
  for (const col of columns) {
    if (['is_anomaly', 'anomaly_reason'].includes(col)) continue;
    const colLower = col.toLowerCase();
    if (q.includes(colLower)) {
      const colVals = records.map(r => r[col]).filter(v => v !== null && v !== undefined);
      const isNum = colVals.length > 0 && colVals.every(v => typeof v === 'number');
      
      if (isNum) {
        const floatVals = colVals.map(Number);
        if (['average', 'mean', 'avg'].some(k => q.includes(k))) {
          const val = floatVals.reduce((a, b) => a + b, 0) / floatVals.length;
          return `The average value of ${col} is ${val.toFixed(4)}.`;
        } else if (['maximum', 'max', 'highest', 'peak'].some(k => q.includes(k))) {
          const val = Math.max(...floatVals);
          return `The maximum value of ${col} is ${val.toFixed(4)}.`;
        } else if (['minimum', 'min', 'lowest'].some(k => q.includes(k))) {
          const val = Math.min(...floatVals);
          return `The minimum value of ${col} is ${val.toFixed(4)}.`;
        } else if (['sum', 'total'].some(k => q.includes(k))) {
          const val = floatVals.reduce((a, b) => a + b, 0);
          return `The sum total of ${col} is ${val.toFixed(4)}.`;
        }
      }
    }
  }

  // 3. Categorical distributions
  for (const col of columns) {
    if (['is_anomaly', 'anomaly_reason'].includes(col)) continue;
    const colLower = col.toLowerCase();
    if (q.includes(colLower) || (colLower === 'status' && q.includes('status')) || (colLower === 'category' && q.includes('category'))) {
      const colVals = records.map(r => String(r[col])).filter(s => s !== null && s !== undefined && s !== "");
      const unique = new Set(colVals);
      if (unique.size < 25) {
        const counts = {};
        for (const v of colVals) counts[v] = (counts[v] || 0) + 1;
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        
        let response = `Here is the distribution breakdown for the ${col} column:\n\n`;
        const totalValid = colVals.length;
        for (const [k, v] of sorted) {
          const percentage = totalValid > 0 ? (v / totalValid) * 100 : 0;
          response += `- ${k}: ${v} records (${percentage.toFixed(1)}%)\n`;
        }
        return response;
      }
    }
  }

  // 4. Text query keyword search
  const match = q.match(/["'](.*?)["']/);
  if (match) {
    const searchTerm = match[1].toLowerCase();
    const textCols = columns.filter(col => !['ticket_id', 'client_ip', 'device_id', 'is_anomaly', 'anomaly_reason'].includes(col));
    for (const col of textCols) {
      const matches = [];
      for (let idx = 0; idx < records.length; idx++) {
        const valStr = String(records[idx][col] || '').toLowerCase();
        if (valStr.includes(searchTerm)) {
          matches.push({ idx, text: records[idx][col] });
        }
      }
      if (matches.length > 0) {
        let response = `Found ${matches.length} records where ${col} contains '${searchTerm}':\n\n`;
        for (const m of matches.slice(0, 5)) {
          response += `- Row ${m.idx}: ${m.text}\n`;
        }
        if (matches.length > 5) {
          response += `\n(Showing 5 of ${matches.length} matching records)`;
        }
        return response;
      }
    }
  }

  // 5. Row count
  if (['row', 'record', 'how many', 'count', 'size'].some(k => q.includes(k))) {
    return `The dataset currently has ${records.length} processed rows and ${columns.length} clean data columns.`;
  }

  return (
    "I analyzed your request using the local offline parser, but couldn't resolve a precise database action.\n\n" +
    "Here are examples of questions I can answer directly:\n" +
    "- 'How many anomalies were found?'\n" +
    "- 'Why did temperature spike?' (explanations of anomalies)\n" +
    "- 'What is the average temperature?' (or humidity, vibration, response_time_ms)\n" +
    "- 'What is the highest vibration?'\n" +
    "- 'Show status code distribution'\n" +
    "- 'Show category breakdown'\n\n" +
    "Tip: Configure an LLM API key (Gemini, Hugging Face, or OpenAI) in the dashboard settings to unlock full natural language reasoning and custom reporting!"
  );
}

async function queryLLMEngine(provider, modelName, apiKey, prompt, systemInstruction) {
  if (provider === 'gemini') {
    try {
      const model = modelName || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
      };
      
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!r.ok) {
        const errJson = await r.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${r.status}`);
      }
      const data = await r.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No text generated.";
    } catch (e) {
      return `Gemini API Error: ${e.message}`;
    }
  } else if (provider === 'openai') {
    try {
      const model = modelName || 'gpt-4o-mini';
      const url = 'https://api.openai.com/v1/chat/completions';
      const messages = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });
      
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages })
      });
      
      if (!r.ok) {
        const errJson = await r.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${r.status}`);
      }
      const data = await r.json();
      return data?.choices?.[0]?.message?.content || "No response generated.";
    } catch (e) {
      return `OpenAI API Error: ${e.message}`;
    }
  } else if (provider === 'anthropic') {
    try {
      const model = modelName || 'claude-3-haiku-20240307';
      const url = 'https://api.anthropic.com/v1/messages';
      
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'dangerouslyAllowBrowser': 'true' // In front-end context
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemInstruction || undefined,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`HTTP ${r.status}: ${text}`);
      }
      const data = await r.json();
      return data?.content?.[0]?.text || "No content generated.";
    } catch (e) {
      return `Claude API Error: ${e.message}`;
    }
  } else if (provider === 'huggingface') {
    try {
      const model = modelName || 'meta-llama/Meta-Llama-3-8B-Instruct';
      const url = `https://api-inference.huggingface.co/models/${model}`;
      const combinedPrompt = `<|system|>\n${systemInstruction || 'You are a data assistant.'}\n<|user|>\n${prompt}\n<|assistant|>\n`;
      
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          inputs: combinedPrompt,
          parameters: { max_new_tokens: 512, return_full_text: false }
        })
      });
      
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`HTTP ${r.status}: ${text}`);
      }
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0].generated_text || "";
      }
      return JSON.stringify(data);
    } catch (e) {
      return `Hugging Face API Error: ${e.message}`;
    }
  } else if (provider === 'ollama') {
    try {
      const endpoint = apiKey || 'http://localhost:11434';
      const url = `${endpoint}/api/generate`;
      
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName || 'llama3',
          prompt: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt,
          stream: false
        })
      });
      
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.response || "";
    } catch (e) {
      return `Ollama Error: ${e.message}`;
    }
  }
  return "Error: Unknown LLM provider configuration.";
}

function getDatasetContextSummary(records) {
  const totalRows = records.length;
  const anomalies = records.filter(r => String(r.is_anomaly).toLowerCase() === 'true' || r.is_anomaly === 1 || r.is_anomaly === true);
  const anomCount = anomalies.length;
  const columns = totalRows > 0 ? Object.keys(records[0]).join(', ') : '';
  
  let summary = `Dataset statistics:\n`;
  summary += `- Total Rows: ${totalRows}\n`;
  summary += `- Anomalous Rows: ${anomCount}\n`;
  summary += `- Columns: ${columns}\n\n`;
  
  summary += "Sample records:\n";
  summary += JSON.stringify(records.slice(0, 5), null, 2);
  summary += "\n\n";
  
  if (anomCount > 0) {
    summary += "Sample anomaly records:\n";
    summary += JSON.stringify(anomalies.slice(0, 5), null, 2);
    summary += "\n\n";
  }
  
  return summary;
}

export async function getPipelineSummary(records, anomaliesCount, provider, modelName, apiKey) {
  if (!provider || provider === 'offline' || !apiKey) {
    return generateOfflineSummary(records, anomaliesCount);
  }
  
  const context = getDatasetContextSummary(records);
  const systemInst = "You are SmartStream's Executive AI Insights engine. Your goal is to analyze the processed operational dataset context and write a premium, compelling executive summary. Identify patterns, key averages, and highlight specific anomalies.";
  const prompt = `Please analyze the following dataset context and write a comprehensive, professional summary of your findings.\nMake it structured with markdown headings, bullet points, and high-impact conclusions.\n\n${context}`;
  
  return queryLLMEngine(provider, modelName, apiKey, prompt, systemInst);
}

export async function answerDatasetQuestion(records, question, chatHistory, provider, modelName, apiKey) {
  if (!provider || provider === 'offline' || !apiKey) {
    return runOfflineQA(records, question, chatHistory);
  }
  
  const context = getDatasetContextSummary(records);
  const historyStr = chatHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
  
  const systemInst = "You are SmartStream Q&A, an advanced analytical agent. You answer user questions about the ingested dataset. Use the dataset context provided to answer accurately. If they ask for averages, counts, or anomalies, perform the mental calculation based on the sample records or the statistics provided. Keep responses structured and useful.";
  const prompt = `Here is the dataset context:\n${context}\n\nChat History:\n${historyStr}\nUser Question: ${question}\n\nWrite your response to the user's question now:`;
  
  return queryLLMEngine(provider, modelName, apiKey, prompt, systemInst);
}
