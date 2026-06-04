import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Sparkles, Database, HelpCircle, Activity, Sun, Moon } from 'lucide-react';

import IngestionZone from './components/IngestionZone';
import DataCleaner from './components/DataCleaner';
import Dashboard from './components/Dashboard';
import InsightPanel from './components/InsightPanel';
import QAChat from './components/QAChat';
import LoginPage from './components/LoginPage';
import DatasetComparator from './components/DatasetComparator';

export default function App() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
    (window.location.port === '5173' || window.location.port === '5174' || window.location.port === '5175'
      ? 'http://localhost:5000'
      : '');
  
  // Auth state
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('smartstream_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Routing state
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'compare'

  // Pipeline status & states
  const [pipelineStatus, setPipelineStatus] = useState('idle'); 
  const [rawStats, setRawStats] = useState(null);
  const [report, setReport] = useState(null);
  const [activePresetId, setActivePresetId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [downloadTimestamp, setDownloadTimestamp] = useState(Date.now());

  // Theme settings
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('smartstream_theme');
    return saved ? saved : 'dark';
  });

  // LLM Config state
  const [showSettings, setShowSettings] = useState(false);
  const [llmSettings, setLlmSettings] = useState(() => {
    const saved = localStorage.getItem('smartstream_llm');
    return saved ? JSON.parse(saved) : {
      provider: 'offline',
      modelName: '',
      apiKey: ''
    };
  });

  // Apply theme to document body
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('smartstream_theme', theme);
  }, [theme]);

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('smartstream_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('smartstream_user');
    handleReset();
    setActivePage('dashboard');
  };

  const handleDataStaged = (stats, target, presetId) => {
    setRawStats(stats);
    setReport(null);
    setActivePresetId(presetId);
    setPipelineStatus('staged');
  };

  const handleReset = async () => {
    setRawStats(null);
    setReport(null);
    setPipelineStatus('idle');
    try {
      await fetch(`${BACKEND_URL}/api/reset-dual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcessData = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.reportA) {
          setReport(data.reportA);
          setPipelineStatus('cleaned');
          setDownloadTimestamp(Date.now());
        }
      } else {
        alert(data.error || "Failed to process staged data");
      }
    } catch (err) {
      alert("Error connecting to backend execution pipeline.");
    } finally {
      setProcessing(false);
    }
  };

  const saveSettings = (newSettings) => {
    setLlmSettings(newSettings);
    localStorage.setItem('smartstream_llm', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  // If not logged in, show Auth Gate
  if (!currentUser) {
    return (
      <div className="login-screen-wrapper">
        <div className="app-container" style={{ justifyContent: 'center', minHeight: '100vh' }}>
          <header className="app-header" style={{ borderBottom: 'none', justifyContent: 'center', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <h1 className="app-title logo-animate" style={{ fontSize: '2.2rem' }}>
              <Activity size={32} className="logo-entrance-animate" style={{ color: 'hsl(var(--primary))' }} />
              SmartStream
            </h1>
            <div className="app-subtitle">Real-Time Intelligent Operational Data Pipeline</div>
          </header>
          <LoginPage onLoginSuccess={handleLoginSuccess} backendUrl={BACKEND_URL} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Banner Header */}
      <header className="app-header" style={{ paddingBottom: '0.6rem' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => setActivePage('dashboard')}>
          <h1 className="app-title logo-animate" style={{ fontSize: '1.5rem' }}>
            <Activity size={22} className="logo-entrance-animate" style={{ color: 'hsl(var(--primary))' }} />
            SmartStream
          </h1>
          <div className="app-subtitle" style={{ fontSize: '0.75rem' }}>Real-Time Intelligent Operational Data Pipeline</div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Page Router Button - Text Only */}
          {activePage === 'dashboard' ? (
            <button 
              onClick={() => setActivePage('compare')} 
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
            >
              Compare Datasets
            </button>
          ) : (
            <button 
              onClick={() => setActivePage('dashboard')} 
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
            >
              Back to Dashboard
            </button>
          )}

          {/* Database logged in indicator */}
          <div style={{
            fontSize: '0.7rem',
            color: 'hsl(var(--success))',
            backgroundColor: 'hsl(var(--success-glow))',
            padding: '0.35rem 0.65rem',
            borderRadius: '15px',
            border: '1px solid hsl(var(--success) / 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <span className="pulse-dot" />
            <span>Supabase: {currentUser.username}</span>
          </div>

          {/* Active LLM indicator */}
          <div style={{
            fontSize: '0.7rem',
            color: 'hsl(var(--text-secondary))',
            backgroundColor: 'hsl(var(--bg-panel))',
            padding: '0.35rem 0.65rem',
            borderRadius: '15px',
            border: '1px solid hsl(var(--border-light))',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}>
            <Sparkles size={11} className="text-secondary" style={{ color: 'hsl(var(--accent-purple))' }} />
            <span>LLM: {llmSettings.provider === 'offline' ? 'Offline Parser' : `${llmSettings.provider.toUpperCase()} (${llmSettings.modelName})`}</span>
          </div>

          {/* Download Cleaned CSV Button - Text Only */}
          {activePage === 'dashboard' && pipelineStatus === 'cleaned' && report && (
            <a 
              href={`${BACKEND_URL}/api/download-cleaned?target=A&username=${currentUser.username}&t=${downloadTimestamp}`}
              download
              className="btn btn-primary animate-fade-in"
              style={{
                textDecoration: 'none',
                padding: '0.4rem 0.85rem',
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              Export Clean CSV
            </a>
          )}

          {/* Theme Toggle Button - Text Only */}
          <button 
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          
          {/* Settings Button - Text Only */}
          <button 
            onClick={() => setShowSettings(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
            title="Configure Pipeline AI Settings"
          >
            AI Settings
          </button>

          {/* Logout Button - Text Only */}
          <button 
            onClick={handleLogout}
            className="btn-danger"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.7rem' }}
            title="Log Out Session"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Conditionally Render Pages */}
      {activePage === 'dashboard' ? (
        <main className="dashboard-grid">
          {/* Left Column: Data Loading, Cleaning & Schema */}
          <section className="sidebar-panel">
            <IngestionZone 
              onDataStaged={handleDataStaged} 
              backendUrl={BACKEND_URL} 
              onReset={handleReset}
              username={currentUser.username}
            />
            
            <DataCleaner 
              rawStats={rawStats}
              report={report} 
              pipelineStatus={pipelineStatus}
            />
          </section>

          {/* Right Column: Visualization, NLP Report, Q&A Chat */}
          <section className="main-content-panel">
            <Dashboard 
              rawStats={rawStats}
              report={report} 
              pipelineStatus={pipelineStatus}
              onProcess={handleProcessData}
              processing={processing}
              onRedirectToCompare={() => setActivePage('compare')}
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <InsightPanel 
                report={report} 
                backendUrl={BACKEND_URL}
                llmSettings={llmSettings}
                username={currentUser.username}
              />
              
              <QAChat 
                report={report}
                presetId={activePresetId}
                backendUrl={BACKEND_URL}
                llmSettings={llmSettings}
                username={currentUser.username}
              />
            </div>
          </section>
        </main>
      ) : (
        <DatasetComparator backendUrl={BACKEND_URL} username={currentUser.username} />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          currentSettings={llmSettings} 
          onSave={saveSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
}

// Subcomponent: Settings Modal
function SettingsModal({ currentSettings, onSave, onClose }) {
  const [provider, setProvider] = useState(currentSettings.provider);
  const [modelName, setModelName] = useState(currentSettings.modelName);
  const [apiKey, setApiKey] = useState(currentSettings.apiKey);

  const handleProviderChange = (newProv) => {
    setProvider(newProv);
    if (newProv === 'gemini') setModelName('gemini-1.5-flash');
    else if (newProv === 'openai') setModelName('gpt-4o-mini');
    else if (newProv === 'ollama') setModelName('llama3');
    else if (newProv === 'huggingface') setModelName('meta-llama/Meta-Llama-3-8B-Instruct');
    else if (newProv === 'anthropic') setModelName('claude-3-haiku-20240307');
    else {
      setModelName('');
      setApiKey('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ provider, modelName, apiKey });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease forwards'
    }}>
      <div className="glass-panel" style={{ width: '450px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={20} className="text-primary" />
            Pipeline AI Configuration
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-secondary))', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>LLM Provider</label>
            <select value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
              <option value="offline">Offline Parser (Zero-Setup Fallback)</option>
              <option value="gemini">Google Gemini API (Generous Free Tier)</option>
              <option value="ollama">Ollama (Fully Local Open-Source)</option>
              <option value="huggingface">Hugging Face Serverless (Free Open-Source)</option>
              <option value="openai">OpenAI (GPT Models)</option>
              <option value="anthropic">Anthropic Claude</option>
            </select>
          </div>

          {provider !== 'offline' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Model ID / Name</label>
                <input 
                  type="text" 
                  value={modelName} 
                  onChange={(e) => setModelName(e.target.value)} 
                  placeholder="e.g., gemini-1.5-flash"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>
                  {provider === 'ollama' ? 'Ollama Server Endpoint URL' : 'API Access Key / Secret Token'}
                </label>
                <input 
                  type={provider === 'ollama' ? 'text' : 'password'}
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'Paste authorization credentials here...'}
                  required={provider !== 'ollama'}
                />
                <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>
                  {provider === 'ollama' ? 'Defaults to local Ollama on port 11434' : 'Keys are stored locally in your browser memory.'}
                </span>
              </div>
            </>
          )}

          {provider === 'offline' && (
            <div style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'hsl(var(--primary-glow))',
              border: '1px solid hsl(var(--primary) / 0.2)',
              fontSize: '0.75rem',
              lineHeight: 1.4,
              color: 'hsl(var(--text-secondary))'
            }}>
              💡 The offline engine executes queries using a regex translator in python against the pandas dataset. It doesn't need an active network connection or access credentials.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Apply Settings</button>
          </div>

        </form>
      </div>
    </div>
  );
}
