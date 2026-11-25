import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Cpu,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  RefreshCw,
  ShieldAlert,
  FileUp,
  FileText,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from './api.js';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'dataset', label: 'Dataset management', icon: FileUp },
  { id: 'model-training', label: 'Model training', icon: Cpu },
  { id: 'model-evaluation', label: 'Model evaluation', icon: Gauge },
  { id: 'prediction', label: 'Machine prediction', icon: Activity },
  { id: 'alerts', label: 'Maintenance alerts', icon: Bell },
  { id: 'reports', label: 'Performance reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = location.pathname.slice(1) || 'dashboard';
  const [dashboard, setDashboard] = useState({ stats: {}, riskDistribution: {}, readingsTrend: [], predictions: [] });
  const [alerts, setAlerts] = useState([]);
  const [model, setModel] = useState({ trained: false, dataset: 'data/ai4i2020.csv' });
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = async () => {
    try {
      const [health, summary, alertRows, modelState] = await Promise.all([
        api.health(), api.dashboard(), api.alerts(), api.model(),
      ]);
      setConnected(health.status === 'ok');
      setDashboard(summary);
      setAlerts(alertRows);
      setModel(modelState);
      setNotice((current) => current?.type === 'error' ? null : current);
    } catch (error) {
      setConnected(false);
      setNotice({ type: 'error', text: error.message || 'Java API is unavailable.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const runAction = async (action, successMessage) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await action();
      setNotice({ type: 'success', text: successMessage(response) });
      await refresh();
      return response;
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submitPrediction = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const reading = Object.fromEntries(formData.entries());
    for (const key of ['airTemp', 'processTemp', 'rotationalSpeed', 'torque', 'toolWear']) {
      reading[key] = Number(reading[key]);
    }
    const prediction = await runAction(() => api.predict(reading), () => 'Assessment saved to the database.');
    if (prediction) setResult(prediction);
  };

  const choosePage = (nextPage) => {
    navigate(nextPage === 'dashboard' ? '/' : `/${nextPage}`);
    setMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={19} strokeWidth={2.2} /></div>
          <div>
            <div className="brand-name">Predictive Maintainance<br />Equipment Failure System</div>
            <div className="brand-caption">PREDICTIVE OPERATIONS</div>
          </div>
        </div>

        <div className="plant-select">
          <span className="plant-symbol"><Gauge size={16} /></span>
          <span className="plant-copy"><small>WORKSPACE</small><strong>North plant</strong></span>
          <ChevronDown size={15} className="plant-chevron" />
        </div>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => choosePage(id)}>
              <Icon size={17} strokeWidth={1.9} />
              <span>{label}</span>
              {id === 'alerts' && dashboard.stats?.openAlerts > 0 && (
                <span className="nav-count">{dashboard.stats.openAlerts}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help"><CircleHelp size={16} /><span>System documentation</span><ArrowRight size={14} /></div>
          <div className="user-profile">
            <div className="avatar">OP</div>
            <div className="user-copy"><strong>Operations team</strong><small>Plant administrator</small></div>
            <SlidersHorizontal size={16} className="user-settings" />
          </div>
        </div>
      </aside>

      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumbs"><span>North plant</span><span className="crumb-slash">/</span><strong>{navigation.find((item) => item.id === page)?.label}</strong></div>
          <div className="top-actions">
            <label className="global-search"><Search size={15} /><input aria-label="Search recent machine records" placeholder="Search recent records" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
              <span className="connection-dot" />{connected ? 'DATABASE CONNECTED' : 'API OFFLINE'}
            </div>
            <button className="icon-button notification-button" aria-label="Open maintenance alerts" title="Open maintenance alerts" onClick={() => choosePage('alerts')}><Bell size={16} />{dashboard.stats?.openAlerts > 0 && <i />}</button>
            <button className="icon-button" aria-label="Refresh data" title="Refresh data" onClick={refresh}><RefreshCw size={16} /></button>
            <div className="top-date">SHIFT A <span>·</span> {new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className={`notice notice-${notice.type}`} role="status"><span>{notice.type === 'success' ? <Check size={16} /> : <ShieldAlert size={16} />}{notice.text}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={15} /></button></div>}

          <Routes>
            <Route path="/" element={<Overview dashboard={dashboard} model={model} loading={loading} search={search} onNew={() => choosePage('prediction')} onModel={() => choosePage('model-training')} />} />
            <Route path="/dataset" element={<DatasetPage />} />
            <Route path="/model-training" element={<ModelTraining model={model} busy={busy} onTrain={() => runAction(api.train, (data) => `Training complete · ${data.rows.toLocaleString()} rows processed.`)} />} />
            <Route path="/model-evaluation" element={<ModelEvaluation metrics={evaluation} busy={busy} onEvaluate={async () => {
              const data = await runAction(api.evaluate, () => 'Evaluation results loaded from Weka.');
              if (data) setEvaluation(data);
            }} />} />
            <Route path="/prediction" element={<Assessment onSubmit={submitPrediction} result={result} busy={busy} />} />
            <Route path="/alerts" element={<AlertLog alerts={alerts} loading={loading} />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function Overview({ dashboard, model, loading, search, onNew, onModel }) {
  const stats = dashboard.stats || {};
  const predictions = (dashboard.predictions || []).filter((row) =>
    `${row.machineId} ${row.risk} ${row.assessment}`.toLowerCase().includes(search.toLowerCase()));
  const risks = dashboard.riskDistribution || {};
  const riskData = [
    { name: 'Normal', value: risks.low || 0, color: '#31866a' },
    { name: 'Medium risk', value: risks.medium || 0, color: '#d49b43' },
    { name: 'High risk', value: risks.high || 0, color: '#c9614b' },
  ];
  const failureData = [
    { name: 'No predicted failure', value: (risks.low || 0) + (risks.medium || 0), color: '#43886e' },
    { name: 'Predicted failure', value: risks.high || 0, color: '#c9614b' },
  ];
  const readingsTrend = dashboard.readingsTrend || [];
  const values = predictions.map((row) => Number.parseFloat(row.failureProbability) || 0).reverse();
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  return <>
    <PageHeading eyebrow="OPERATIONS / OVERVIEW" title="Production health" description="Monitor equipment risk and recent maintenance decisions."
      action={<button className="button button-primary" onClick={onNew}><Plus size={16} /> New assessment</button>} />

    <section className="metric-grid" aria-label="Plant summary">
      <Metric label="Total machine readings" value={stats.readings ?? '—'} icon={Activity} tone="mint" foot="Rows stored in SQLite" />
      <Metric label="Normal machines" value={stats.normal ?? '—'} icon={Check} tone="mint" foot="LOW-risk predictions" />
      <Metric label="Machines at risk" value={stats.atRisk ?? '—'} icon={ArrowDownRight} tone="amber" foot="MEDIUM or HIGH risk" />
      <Metric label="Predicted failures" value={stats.predictedFailures ?? '—'} icon={ShieldAlert} tone="coral" foot="HIGH-risk predictions" />
      <Metric label="Model training status" value={model.trained ? 'READY' : 'NOT TRAINED'} icon={Cpu} tone={model.trained ? 'mint' : 'amber'} foot="Weka random forest artifact" />
    </section>

    <section className="dashboard-chart-grid">
      <div className="surface chart-panel">
        <div className="surface-heading"><div><div className="eyebrow">DATABASE ACTIVITY</div><h2>Machine readings</h2></div><span className="table-note">Last 8 recorded dates</span></div>
        {readingsTrend.length ? <div className="recharts-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={readingsTrend} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 4" />
          <XAxis dataKey="date" tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ border: '1px solid #e4e6de', borderRadius: 5, fontSize: 11 }} />
          <Line type="monotone" dataKey="readings" name="Readings" stroke="#43886e" strokeWidth={2.5} dot={{ r: 3, fill: '#fffefa', strokeWidth: 2 }} activeDot={{ r: 4 }} />
        </LineChart></ResponsiveContainer></div> : <ChartEmpty text="No machine readings recorded." />}
      </div>

      <div className="surface chart-panel risk-chart-panel">
        <div className="surface-heading"><div><div className="eyebrow">MODEL OUTPUT</div><h2>Failure distribution</h2></div><span className="table-note">Predictions in database</span></div>
        {failureData.some((item) => item.value > 0) ? <div className="risk-chart-content"><div className="risk-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={failureData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">{failureData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #e4e6de', borderRadius: 5, fontSize: 11 }} /></PieChart></ResponsiveContainer></div><div className="risk-legend">{failureData.map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div></div> : <ChartEmpty text="Failure distribution appears after predictions are saved." />}
      </div>

      <div className="surface chart-panel risk-category-panel">
        <div className="surface-heading"><div><div className="eyebrow">RISK CATEGORIES</div><h2>Prediction risk levels</h2></div><span className="table-note">Database totals</span></div>
        {riskData.some((item) => item.value > 0) ? <div className="recharts-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={riskData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 4" />
          <XAxis dataKey="name" tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ border: '1px solid #e4e6de', borderRadius: 5, fontSize: 11 }} />
          <Bar dataKey="value" name="Predictions" radius={[3, 3, 0, 0]} maxBarSize={45}>{riskData.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar>
        </BarChart></ResponsiveContainer></div> : <ChartEmpty text="Risk categories appear after predictions are saved." />}
      </div>
    </section>

    <section className="surface table-panel">
      <div className="surface-heading table-heading"><div><div className="eyebrow">ACTIVITY FEED</div><h2>Recent assessments</h2></div><span className="table-note">{predictions.length} records shown</span></div>
      <PredictionTable predictions={predictions} loading={loading} />
    </section>
  </>;
}

function modelStatusText(model) {
  return model.trained ? 'Model ready' : 'Model needs training';
}

function Metric({ label, value, icon: Icon, tone, foot }) {
  return <article className="metric surface"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div><strong>{value}</strong><div className="metric-foot"><span className={`metric-mark ${tone}`} />{foot}</div></article>;
}

function PredictionTable({ predictions, loading }) {
  if (loading) return <div className="table-empty"><LoaderCircle className="spin" size={18} />Loading recent records</div>;
  if (!predictions.length) return <div className="table-empty">No assessments have been recorded yet.</div>;
  return <div className="table-scroll"><table><thead><tr><th>TIME</th><th>MACHINE</th><th>RISK LEVEL</th><th>FAILURE PROBABILITY</th><th>ASSESSMENT</th></tr></thead><tbody>
    {predictions.map((row, index) => <tr key={`${row.machineId}-${row.time}-${index}`}>
      <td className="mono">{row.time}</td><td className="machine-cell"><span className="machine-avatar"><Cpu size={14} /></span>{row.machineId}</td>
      <td><RiskBadge risk={row.risk} /></td><td><Probability value={row.failureProbability} /></td><td>{row.assessment}</td>
    </tr>)}
  </tbody></table></div>;
}

function RiskBadge({ risk }) {
  const level = (risk || 'LOW').toLowerCase();
  return <span className={`risk-badge risk-${level}`}><i />{risk || 'LOW'}</span>;
}

function Probability({ value }) {
  const percentage = Number.parseFloat(value) || 0;
  return <div className="probability-cell"><span>{percentage.toFixed(1)}%</span><i><b style={{ width: `${Math.min(percentage, 100)}%` }} /></i></div>;
}

function Assessment({ onSubmit, result, busy }) {
  return <>
    <PageHeading eyebrow="OPERATIONS / PREDICTION" title="New assessment" description="Submit a live sensor reading for failure-risk analysis." />
    <div className="assessment-layout">
      <form className="surface assessment-form" onSubmit={onSubmit}>
        <div className="form-section-title"><span className="step-number">01</span><div><h2>Machine details</h2><p>Identify the equipment and current operating conditions.</p></div></div>
        <label className="field field-wide"><span>Machine identifier</span><input name="machineId" required maxLength="80" /><small>Use the ID shown on the equipment register.</small></label>
        <div className="form-divider" />
        <div className="form-section-title"><span className="step-number">02</span><div><h2>Sensor readings</h2><p>Enter the latest measurements from the machine.</p></div></div>
        <div className="field-grid">
          <NumberField name="airTemp" label="Air temperature" unit="K" />
          <NumberField name="processTemp" label="Process temperature" unit="K" />
          <NumberField name="rotationalSpeed" label="Rotational speed" unit="RPM" />
          <NumberField name="torque" label="Torque" unit="Nm" />
          <NumberField name="toolWear" label="Tool wear" unit="min" />
        </div>
        <div className="form-actions"><span><ShieldAlert size={15} /> Values are stored with the assessment.</span><button className="button button-primary" disabled={busy}><Activity size={16} />{busy ? 'Assessing…' : 'Run assessment'}<ArrowRight size={15} /></button></div>
      </form>

      <aside className="surface result-panel">
        <div className="eyebrow">ASSESSMENT RESULT</div>
        {result ? <>
          <div className={`result-gauge result-${result.risk.toLowerCase()}`} style={{ '--gauge': `${Math.min(Number(result.failureProbability), 100)}%` }}><div className="gauge-ring"><strong>{Number(result.failureProbability).toFixed(1)}<small>%</small></strong><span>FAILURE PROBABILITY</span></div></div>
          <RiskBadge risk={result.risk} />
          <h2 className="result-title">{result.assessment}</h2>
          <p className="result-copy">Assessment for <strong>{result.machineId}</strong> has been saved.</p>
          <div className="anomaly-list"><h3>Sensor checks</h3>{result.anomalies.length ? result.anomalies.map((anomaly) => <div className="anomaly-item" key={anomaly}><ShieldAlert size={15} />{anomaly}</div>) : <div className="anomaly-clear"><Check size={15} />No sensor anomalies detected</div>}</div>
        </> : <div className="result-placeholder"><div className="placeholder-icon"><Gauge size={23} /></div><h2>Awaiting readings</h2><p>Submit sensor values to see the machine’s current failure likelihood and sensor checks.</p><div className="placeholder-rule" /></div>}
      </aside>
    </div>
  </>;
}

function NumberField({ name, label, unit }) {
  return <label className="field"><span>{label}</span><div className="number-input"><input type="number" name={name} required step="any" /><span>{unit}</span></div></label>;
}

function AlertLog({ alerts, loading }) {
  const [query, setQuery] = useState('');
  const filtered = alerts.filter((alert) => `${alert.machineId} ${alert.type} ${alert.status} ${alert.message}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeading eyebrow="OPERATIONS / MONITORING" title="Alert log" description="Anomalies and elevated failure risks recorded from machine readings." action={<div className="alert-count"><span />{alerts.filter((item) => item.status === 'OPEN').length} OPEN</div>} />
    <section className="surface table-panel alert-table-panel">
      <div className="filter-bar"><div className="filter-title"><ShieldAlert size={17} /><strong>Maintenance alerts</strong><span>{filtered.length} total</span></div><label className="search-box"><SlidersHorizontal size={15} /><input placeholder="Filter by machine or alert" value={query} onChange={(event) => setQuery(event.target.value)} /><span>FILTER</span></label></div>
      {loading ? <div className="table-empty"><LoaderCircle className="spin" size={18} />Loading alerts</div> : !filtered.length ? <div className="table-empty">No matching alerts. Equipment signals will appear here when recorded.</div> : <div className="table-scroll"><table><thead><tr><th>TIME</th><th>MACHINE</th><th>ALERT TYPE</th><th>STATUS</th><th>DETAIL</th></tr></thead><tbody>
        {filtered.map((alert, index) => <tr key={`${alert.machineId}-${alert.time}-${index}`}><td className="mono">{alert.time}</td><td className="machine-cell"><span className="machine-avatar"><Cpu size={14} /></span>{alert.machineId}</td><td><span className="alert-type"><span />{alert.type.replace('_', ' ')}</span></td><td><span className={`state-pill ${alert.status.toLowerCase()}`}>{alert.status}</span></td><td className="alert-detail">{alert.message}</td></tr>)}
      </tbody></table></div>}
    </section>
    <div className="alert-note"><ShieldAlert size={16} /><span>Alerts are generated by the Java anomaly detector and written to the SQLite maintenance database.</span></div>
  </>;
}

function ChartEmpty({ text }) {
  return <div className="chart-empty"><Activity size={19} /><span>{text}</span></div>;
}

function DatasetPage() {
  const [dataset, setDataset] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.dataset().then(setDataset).catch((loadError) => setError(loadError.message));
  }, []);

  const importFile = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const imported = await api.importDataset(file);
      setDataset(imported);
      setSuccess(`${imported.importedRecords.toLocaleString()} machine readings imported from ${file.name}.`);
      setFile(null);
    } catch (importError) {
      setError(importError.message);
    } finally {
      setBusy(false);
    }
  };

  return <>
    <PageHeading eyebrow="DATA / SOURCE FILES" title="Dataset management" description="Inspect the configured AI4I dataset and import machine readings into SQLite." />
    <div className="dataset-grid">
      <section className="surface upload-panel">
        <div className="eyebrow">CSV IMPORT</div><h2>Import machine readings</h2>
        <p>Upload an AI4I-compatible CSV. Imported sensor readings are added to the existing SQLite database.</p>
        <label className="upload-dropzone"><input type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); setSuccess(''); }} /><span className="upload-icon"><FileUp size={21} /></span><strong>{file ? file.name : 'Choose a CSV file'}</strong><small>{file ? `${(file.size / 1024).toFixed(1)} KB · ready to import` : 'CSV format · maximum 25 MB'}</small><span className="button button-secondary">Browse files</span></label>
        {error && <div className="inline-message inline-error"><ShieldAlert size={15} />{error}</div>}
        {success && <div className="inline-message inline-success"><Check size={15} />{success}</div>}
        <button className="button button-primary upload-submit" onClick={importFile} disabled={!file || busy}>{busy ? <><LoaderCircle size={16} className="spin" /> Importing…</> : <><FileUp size={16} /> Import dataset</>}</button>
      </section>
      <section className="surface dataset-info"><div className="eyebrow">CURRENT DATASET</div><h2>{dataset?.filename || 'Loading dataset…'}</h2><div className="dataset-path">{dataset?.path || 'data/ai4i2020.csv'}</div><div className="dataset-stats"><div><span>LOADED ROWS</span><strong>{dataset ? dataset.rows.toLocaleString() : '—'}</strong></div><div><span>COLUMNS</span><strong>{dataset ? dataset.columns : '—'}</strong></div></div><div className="dataset-source"><span className="source-led" />{dataset ? 'Dataset available to model training' : error ? 'Dataset could not be loaded' : 'Checking configured dataset'}</div></section>
    </div>
    <section className="surface dataset-preview"><div className="surface-heading table-heading"><div><div className="eyebrow">DATA VALIDATION</div><h2>Dataset preview</h2></div><span className="table-note">{dataset ? `First ${dataset.preview.length} of ${dataset.rows.toLocaleString()} rows` : 'Waiting for data'}</span></div>
      {dataset?.preview?.length ? <div className="table-scroll"><table><thead><tr>{dataset.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{dataset.preview.map((row, index) => <tr key={index}>{dataset.headers.map((header) => <td key={header}>{row[header]}</td>)}</tr>)}</tbody></table></div> : <div className="table-empty">{error || 'Dataset preview is loading.'}</div>}
    </section>
  </>;
}

function ModelTraining({ model, busy, onTrain }) {
  return <>
    <PageHeading eyebrow="MODEL / TRAINING" title="Model training" description="Train and save the Weka random forest using the configured AI4I dataset." />
    <div className="model-layout">
      <section className="surface model-card">
        <div className="model-card-header"><div className="model-icon"><Cpu size={19} /></div><span className={`model-state ${model.trained ? 'ready' : 'missing'}`}><i />{model.trained ? 'MODEL READY' : 'MODEL NOT TRAINED'}</span></div>
        <div className="eyebrow">CLASSIFICATION ENGINE</div><h2>Random forest</h2><p className="model-description">Analyzes machine operating conditions to estimate failure likelihood and classify risk.</p>
        <div className="model-facts"><div><span>ALGORITHM</span><strong>Weka random forest</strong></div><div><span>TRAINING DATA</span><strong>AI4I 2020 predictive maintenance</strong></div><div><span>DATASET LOCATION</span><strong className="path-text">{model.dataset}</strong></div><div><span>MODEL LOCATION</span><strong className="path-text">model_artifacts/random_forest.model</strong></div></div>
        {busy && <div className="training-progress"><span /><span /></div>}
        <div className="model-actions"><button className="button button-primary" onClick={onTrain} disabled={busy}><Activity size={16} />{busy ? 'Training random forest…' : 'Train random forest model'}<ArrowRight size={15} /></button></div>
        <div className="model-footnote"><ShieldAlert size={14} />Training uses the CSV on disk and saves the model artifact locally. Existing database records are preserved.</div>
      </section>
      <section className="surface model-side-panel"><div className="eyebrow">MODEL ARTIFACT</div><div className="artifact-visual"><div className="artifact-grid" /><Cpu size={36} strokeWidth={1.35} /><span className="artifact-pin pin-one" /><span className="artifact-pin pin-two" /><span className="artifact-pin pin-three" /></div><h3>Failure classifier</h3><p>Persisted locally and loaded by the Java prediction service.</p><div className="artifact-status"><span className={model.trained ? 'dot-ready' : ''} /><span>{model.trained ? 'Artifact detected' : 'Training required'}</span></div></section>
    </div>
  </>;
}

function ModelEvaluation({ metrics, busy, onEvaluate }) {
  const values = metrics ? [
    { name: 'Accuracy', value: metrics.accuracy, format: (value) => `${Number(value).toFixed(2)}%` },
    { name: 'Precision', value: metrics.precision, format: (value) => Number(value).toFixed(4) },
    { name: 'Recall', value: metrics.recall, format: (value) => Number(value).toFixed(4) },
    { name: 'F1 score', value: metrics.f1Score, format: (value) => Number(value).toFixed(4) },
  ] : [];
  const confusion = metrics?.confusionMatrix;
  return <>
    <PageHeading eyebrow="MODEL / VALIDATION" title="Model evaluation" description="Run 10-fold cross validation and inspect the actual metrics returned by Weka." action={<button className="button button-primary" onClick={onEvaluate} disabled={busy}><Gauge size={16} />{busy ? 'Evaluating…' : 'Evaluate model'}</button>} />
    {busy && <div className="evaluation-loading"><LoaderCircle size={17} className="spin" />Running Weka evaluation on the configured dataset…</div>}
    {metrics ? <>
      <section className="evaluation-metrics">{values.map((item) => <article className="surface evaluation-metric" key={item.name}><span>{item.name}</span><strong>{item.format(item.value)}</strong><small>10-fold cross validation</small></article>)}</section>
      <section className="surface confusion-panel"><div className="surface-heading table-heading"><div><div className="eyebrow">CLASSIFICATION RESULTS</div><h2>Confusion matrix</h2></div><span className="table-note">{metrics.rowsEvaluated.toLocaleString()} rows evaluated</span></div>
        <div className="confusion-grid"><div /><span>PREDICTED NORMAL</span><span>PREDICTED FAILURE</span><strong>ACTUAL NORMAL</strong><b>{confusion.trueNegative}</b><b>{confusion.falsePositive}</b><strong>ACTUAL FAILURE</strong><b>{confusion.falseNegative}</b><b>{confusion.truePositive}</b></div>
      </section>
    </> : <div className="surface evaluation-empty"><div className="placeholder-icon"><Gauge size={23} /></div><h2>No evaluation run yet</h2><p>Run evaluation to load accuracy, precision, recall, F1 score, and the confusion matrix from the Java model service.</p></div>}
  </>;
}

function ReportsPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.reports().then(setReport).catch((loadError) => setError(loadError.message)); }, []);
  const risks = report?.riskDistribution;
  const riskData = risks ? [
    { name: 'Low', value: risks.low, color: '#43886e' },
    { name: 'Medium', value: risks.medium, color: '#d49b43' },
    { name: 'High', value: risks.high, color: '#c9614b' },
  ] : [];
  return <>
    <PageHeading eyebrow="REPORTS / PERFORMANCE" title="Performance reports" description="Review database totals, model validation, and risk distribution." action={<a className="button button-secondary export-button" href="/api/reports/export" download="predictive-maintenance-report.csv"><FileText size={16} /> Export CSV</a>} />
    {report ? <>
      <section className="metric-grid report-metrics"><Metric label="Total machine readings" value={report.stats.readings} icon={Activity} tone="mint" foot="Stored in SQLite" /><Metric label="Normal predictions" value={report.stats.normal} icon={Check} tone="mint" foot="LOW risk" /><Metric label="Machines at risk" value={report.stats.atRisk} icon={ArrowDownRight} tone="amber" foot="MEDIUM or HIGH risk" /><Metric label="Predicted failures" value={report.stats.predictedFailures} icon={ShieldAlert} tone="coral" foot="HIGH risk" /></section>
      <section className="dashboard-chart-grid report-charts"><div className="surface chart-panel"><div className="surface-heading"><div><div className="eyebrow">DATABASE ACTIVITY</div><h2>Readings over time</h2></div></div>{report.readingsTrend.length ? <div className="recharts-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.readingsTrend}><CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 4" /><XAxis dataKey="date" tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="readings" stroke="#43886e" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <ChartEmpty text="No readings are available to report." />}</div>
        <div className="surface chart-panel"><div className="surface-heading"><div><div className="eyebrow">RISK DISTRIBUTION</div><h2>Model predictions</h2></div></div>{riskData.some((item) => item.value > 0) ? <div className="recharts-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={riskData}><CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 4" /><XAxis dataKey="name" tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" name="Predictions" radius={[3, 3, 0, 0]}>{riskData.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div> : <ChartEmpty text="No risk predictions are available to report." />}</div></section>
      <section className="surface evaluation-panel"><div className="surface-heading table-heading"><div><div className="eyebrow">MODEL VALIDATION</div><h2>Evaluation metrics</h2></div></div>{report.modelMetrics ? <div className="report-model-metrics">{[['Accuracy', `${report.modelMetrics.accuracy.toFixed(2)}%`], ['Precision', report.modelMetrics.precision.toFixed(4)], ['Recall', report.modelMetrics.recall.toFixed(4)], ['F1 score', report.modelMetrics.f1Score.toFixed(4)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div> : <div className="table-empty">Model metrics are unavailable until a trained model artifact exists.</div>}</section>
    </> : <div className="surface table-empty">{error || <><LoaderCircle size={17} className="spin" />Loading report data</>}</div>}
  </>;
}

function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.settings().then(setSettings).catch((loadError) => setError(loadError.message)); }, []);
  return <>
    <PageHeading eyebrow="SYSTEM / CONFIGURATION" title="Settings" description="Service and storage configuration reported by the Java application." />
    <section className="surface settings-panel"><div className="eyebrow">CONNECTED SERVICES</div><h2>Application configuration</h2>{settings ? <div className="settings-list"><div><span>Java API</span><strong>{settings.api}</strong></div><div><span>Database</span><strong>SQLite · {settings.database}</strong></div><div><span>Dataset</span><strong>{settings.dataset}</strong></div><div><span>Model artifact</span><strong>{settings.model}</strong></div></div> : <div className="table-empty">{error || 'Loading service settings…'}</div>}</section>
  </>;
}

export default App;