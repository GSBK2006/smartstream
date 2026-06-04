import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, AlertCircle, Sparkles } from 'lucide-react';

export default function QAChat({ report, presetId, backendUrl, llmSettings, username }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Suggested questions map
  const suggestionsMap = {
    iot_sensors: [
      "How many anomalies were found?",
      "Why did the temperature spike?",
      "What is the average vibration level?"
    ],
    server_logs: [
      "Show status code distribution",
      "Explain the server errors",
      "What is the peak response time?"
    ],
    support_tickets: [
      "What is the average customer rating?",
      "Search feedbacks containing 'crash'",
      "Why is billing priority high?"
    ],
    fallback: [
      "How many rows were processed?",
      "Show details of anomalies",
      "Summarize this dataset"
    ]
  };

  const getSuggestions = () => {
    return suggestionsMap[presetId] || suggestionsMap.fallback;
  };

  useEffect(() => {
    // Reset conversation on dataset reload
    if (report) {
      setMessages([
        {
          role: 'bot',
          text: `👋 Active dataset loaded! I am the SmartStream Q&A assistant. Ask me anything about the processed telemetry, logs, or feedback fields.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [report, presetId]);

  useEffect(() => {
    // Auto-scroll to bottom of chat
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const question = textToSend || input;
    if (!question.trim()) return;

    if (!textToSend) setInput('');
    setError(null);

    const userMessage = {
      role: 'user',
      text: question,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch(`${backendUrl}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          question: question,
          chat_history: messages.map(m => ({ role: m.role, text: m.text })),
          provider: llmSettings.provider,
          model_name: llmSettings.modelName,
          api_key: llmSettings.apiKey
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: data.answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        setError(data.error || "Failed to process question");
      }
    } catch (err) {
      setError("Network error connecting to Q&A database parser.");
    } finally {
      setLoading(false);
    }
  };

  if (!report) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', color: 'hsl(var(--text-muted))' }}>
        <MessageSquare size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.85rem' }}>Pipeline conversation unavailable. Ingest data first.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel glow-purple animate-fade-in chat-container">
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid hsl(var(--border-light))', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={16} className="text-primary" />
          Conversational Q&A Engine
        </h3>
        <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Sparkles size={12} /> {llmSettings.provider.toUpperCase()} Mode
        </span>
      </div>

      {/* Suggestion list */}
      <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', overflowX: 'auto', borderBottom: '1px solid hsl(var(--border-light) / 0.5)', whiteSpace: 'nowrap' }}>
        {getSuggestions().map((s, idx) => (
          <button
            key={idx}
            onClick={() => !loading && handleSend(s)}
            className="btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.7rem', borderRadius: '15px' }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role}`}>
            {/* simple markdown formatting inside bubble */}
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {m.text.split('\n').map((para, i) => {
                if (para.startsWith('- ')) {
                  return <li key={i} style={{ marginLeft: '1rem', listStyleType: 'circle' }}>{para.substring(2)}</li>;
                }
                return <p key={i} style={{ marginBottom: i < m.text.split('\n').length - 1 ? '0.5rem' : '0' }}>{para}</p>;
              })}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-secondary))', textAlign: 'right', marginTop: '0.4rem', opacity: 0.7 }}>
              {m.time}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="chat-bubble bot" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--text-muted))' }}>
            <span className="dot-pulse">●</span>
            <span style={{ fontSize: '0.8rem' }}>AI translating question to pipeline query...</span>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'hsl(var(--danger) / 0.12)',
            border: '1px solid hsl(var(--danger) / 0.3)',
            color: 'hsl(var(--danger))',
            fontSize: '0.8rem',
            margin: '0 1rem'
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="chat-input-area">
        <input
          type="text"
          placeholder="Ask a question (e.g. 'what is the highest temperature?')..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()} style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}>
          Send
        </button>
      </form>
    </div>
  );
}
