import React, { useState, useEffect } from 'react';
import { Lightbulb, RefreshCw, AlertCircle } from 'lucide-react';
import { getPipelineSummary } from '../utils/nlpEngine';

export default function InsightPanel({ report, backendUrl, llmSettings, username }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (report) {
      generateSummary();
    } else {
      setSummary('');
    }
  }, [report, llmSettings]);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryText = await getPipelineSummary(
        report.data,
        report.stats.anomaly_count,
        llmSettings.provider,
        llmSettings.modelName,
        llmSettings.apiKey
      );
      setSummary(summaryText);
    } catch (err) {
      setError("Unable to generate summary: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!report) {
    return null;
  }

  const formatMarkdown = (text) => {
    if (!text) return '';
    
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      
      if (trimmed.startsWith('### ')) {
        return <h4 key={idx} style={{ color: 'hsl(var(--text-primary))', fontFamily: 'var(--font-display)', fontSize: '1rem', marginTop: '1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid hsl(var(--border-light))', paddingBottom: '0.25rem' }}>{trimmed.replace('### ', '')}</h4>;
      }
      if (trimmed.startsWith('#### ')) {
        return <h5 key={idx} style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginTop: '1rem', marginBottom: '0.4rem', fontWeight: 600 }}>{trimmed.replace('#### ', '')}</h5>;
      }
      
      if (trimmed.startsWith('- ')) {
        const content = trimmed.replace('- ', '');
        const parts = content.split('**');
        return (
          <li key={idx} style={{ marginLeft: '1rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.4rem', listStyleType: 'square' }}>
            {parts.map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'hsl(var(--text-primary))' }}>{part}</strong> : part)}
          </li>
        );
      }
      
      if (trimmed.length > 0) {
        const parts = trimmed.split('**');
        return (
          <p key={idx} style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            {parts.map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'hsl(var(--text-primary))' }}>{part}</strong> : part)}
          </p>
        );
      }
      
      return <div key={idx} style={{ height: '0.5rem' }}></div>;
    });
  };

  return (
    <div className="glass-panel glow-purple animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lightbulb size={18} style={{ color: 'hsl(var(--warning))' }} />
          AI Execution Summary
        </h3>
        {/* Button with no icon */}
        <button 
          onClick={generateSummary} 
          disabled={loading}
          className="btn-secondary"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '150px', gap: '0.75rem', color: 'hsl(var(--text-muted))' }}>
          <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite', color: 'hsl(var(--primary))' }} />
          <p style={{ fontSize: '0.75rem' }}>Analyzing cleaned pipeline anomalies...</p>
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'hsl(var(--danger) / 0.1)', border: '1px solid hsl(var(--danger) / 0.3)', color: 'hsl(var(--danger))', fontSize: '0.8rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : (
        <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {formatMarkdown(summary)}
        </div>
      )}
    </div>
  );
}
