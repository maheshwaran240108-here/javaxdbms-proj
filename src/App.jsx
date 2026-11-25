import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Check,
  Cpu,
  Download,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  FileUp,
  FileText,
  X,
} from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from './api.js';
import { downloadAiReportPdf } from './pdfReport.js';

const navigation = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'prediction', label: 'New Assessment', icon: Plus },
  { id: 'alerts', label: 'Maintenance alerts', icon: Bell },
  { id: 'dataset', label: 'Dataset management', icon: FileUp },
  { id: 'model-training', label: 'Model training', icon: Cpu },
  { id: 'model-evaluation', label: 'Model evaluation', icon: Gauge },
  { id: 'reports', label: 'Performance reports', icon: FileText },
];

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unable to render this section.' };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.routeKey !== this.props.routeKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="surface table-empty" role="alert">
          <ShieldAlert size={18} />
          <span>{this.state.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);

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
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && (
            <div className="brand-lockup">
              <div className="brand-mark"><Activity size={19} strokeWidth={2.2} /></div>
              <div className="brand-name">Predictive Maintenance<br />Equipment Failure System</div>
            </div>
          )}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => choosePage(id)}
              title={sidebarCollapsed ? label : undefined}
              aria-label={label}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
          <div className="breadcrumbs"><strong>{navigation.find((item) => item.id === page)?.label || 'Overview'}</strong></div>
          <div className="top-actions">
            <label className="global-search"><Search size={15} /><input aria-label="Search recent machine records" placeholder="Search recent records" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className={`notice notice-${notice.type}`} role="status"><span>{notice.type === 'success' ? <Check size={16} /> : <ShieldAlert size={16} />}{notice.text}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={15} /></button></div>}

          <RouteErrorBoundary routeKey={location.pathname}>
            <Routes>
              <Route path="/" element={<Overview dashboard={dashboard} alerts={alerts} loading={loading} search={search} onAlerts={() => choosePage('alerts')} onSelectMachine={setSelectedMachine} />} />
              <Route path="/dataset" element={<DatasetPage onSelectMachine={setSelectedMachine} />} />
              <Route path="/model-training" element={<ModelTraining model={model} busy={busy} onTrain={() => runAction(api.train, (data) => `Model training completed successfully! (${data.rows.toLocaleString()} machine records studied)`)} />} />
              <Route path="/model-evaluation" element={<ModelEvaluation metrics={evaluation} busy={busy} onEvaluate={async () => {
                const data = await runAction(api.evaluate, () => 'Evaluation results loaded from Weka.');
                if (data) setEvaluation(data);
              }} />} />
              <Route path="/prediction" element={<Assessment onSubmit={submitPrediction} onClearResult={() => setResult(null)} result={result} busy={busy} />} />
              <Route path="/alerts" element={<AlertLog alerts={alerts} loading={loading} />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RouteErrorBoundary>
        </div>
        <MachineImageModal machine={selectedMachine} onClose={() => setSelectedMachine(null)} />
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

function Overview({ dashboard, alerts, loading, search, onAlerts, onSelectMachine }) {
  const stats = dashboard.stats || {};
  const predictions = (dashboard.predictions || []).filter((row) =>
    `${row.machineId} ${row.risk} ${row.assessment}`.toLowerCase().includes(search.toLowerCase()));
  const uniqueMachines = new Set((dashboard.predictions || []).map((row) => row.machineId).filter(Boolean)).size;
  const recentAlerts = (alerts || []).slice(0, 5);
  const risks = dashboard.riskDistribution || {};
  const totalPredictions = (risks.low || 0) + (risks.medium || 0) + (risks.high || 0);
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

  return <>
    <PageHeading
      eyebrow="OPERATIONS / OVERVIEW"
      title="Predictive Maintenance and Equipment Failure Prediction System"
      description="Monitor equipment health, sensor readings, failure predictions, and maintenance alerts."
    />

    <section className="metric-grid" aria-label="Plant summary">
      <Metric label="Total Machines" value={uniqueMachines || '—'} icon={Cpu} tone="navy" foot="Distinct units monitored" />
      <Metric label="Total Readings" value={stats.readings ?? '—'} icon={Activity} tone="mint" foot="Recorded sensor entries" />
      <Metric label="Total Predictions" value={totalPredictions || '—'} icon={Gauge} tone="mint" foot="Completed risk assessments" />
      <Metric label="Open Maintenance Alerts" value={stats.openAlerts ?? '—'} icon={Bell} tone="amber" foot="Active anomaly & risk flags" />
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

    <section className="overview-bottom-grid">
      <div className="surface table-panel">
        <div className="surface-heading table-heading"><div><div className="eyebrow">ACTIVITY FEED</div><h2>Recent records</h2></div><span className="table-note">{predictions.length} records shown</span></div>
        <PredictionTable predictions={predictions} loading={loading} onSelectMachine={onSelectMachine} />
      </div>

      <aside className="surface alert-feed-panel">
        <div className="surface-heading table-heading">
          <div><div className="eyebrow">ANOMALY MONITOR</div><h2>Recent maintenance alerts</h2></div>
          <span className="table-note">{stats.openAlerts ?? 0} open</span>
        </div>
        {loading ? (
          <div className="table-empty"><LoaderCircle className="spin" size={18} />Loading alerts</div>
        ) : recentAlerts.length ? (
          <div className="alert-feed-list">
            {recentAlerts.map((alert, index) => (
              <div className="alert-feed-item" key={`${alert.machineId}-${alert.time}-${index}`}>
                <div className="alert-feed-top">
                  <span className="alert-feed-machine"><Cpu size={13} /> {alert.machineId}</span>
                  <span className={`state-pill ${(alert.status || 'OPEN').toLowerCase()}`}>{alert.status || 'OPEN'}</span>
                </div>
                <p className="alert-feed-msg">{alert.message}</p>
                <div className="alert-feed-meta">
                  <span>{(alert.type || 'ALERT').replace('_', ' ')}</span>
                  <span>{alert.time}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-empty">No maintenance alerts recorded yet.</div>
        )}
        <button type="button" className="panel-footer-link" onClick={onAlerts}>
          <span>View full alert log</span>
          <ArrowRight size={14} />
        </button>
      </aside>
    </section>
  </>;
}

function modelStatusText(model) {
  return model.trained ? 'Model ready' : 'Model needs training';
}

function Metric({ label, value, icon: Icon, tone, foot }) {
  return <article className="metric surface"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div><strong>{value}</strong><div className="metric-foot"><span className={`metric-mark ${tone}`} />{foot}</div></article>;
}

function PredictionTable({ predictions, loading, onSelectMachine }) {
  if (loading) return <div className="table-empty"><LoaderCircle className="spin" size={18} />Loading recent records</div>;
  if (!predictions.length) return <div className="table-empty">No assessments have been recorded yet.</div>;
  const uniqueIds = Array.from(new Set(predictions.map((row) => row.machineId)));
  return <div className="table-scroll"><table><thead><tr><th>TIME</th><th>MACHINE</th><th>RISK LEVEL</th><th>FAILURE PROBABILITY</th><th>ASSESSMENT</th></tr></thead><tbody>
    {predictions.map((row, index) => <tr key={`${row.machineId}-${row.time}-${index}`}>
      <td className="mono">{row.time}</td>
      <td className="machine-cell">
        <button
          type="button"
          className="product-id-link"
          onClick={() => onSelectMachine?.({ productId: row.machineId, imageIndex: uniqueIds.indexOf(row.machineId), risk: row.risk, failureProbability: row.failureProbability, assessment: row.assessment, time: row.time })}
          title={`Preview machine ${row.machineId}`}
        >
          <span className="machine-avatar"><Cpu size={14} /></span>
          <span>{row.machineId}</span>
        </button>
      </td>
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
  const [machineInput, setMachineInput] = useState('');
  const [lookup, setLookup] = useState({ status: 'idle', exists: false, machineId: '' });
  const [imgSrc, setImgSrc] = useState(null);
  const [imgLabel, setImgLabel] = useState('');

  const activeId = machineInput.trim();

  useEffect(() => {
    if (!activeId) {
      setLookup({ status: 'idle', exists: false, machineId: '' });
      setImgSrc(null);
      setImgLabel('');
      return undefined;
    }
    let cancelled = false;
    setLookup((prev) => ({ ...prev, status: 'checking', machineId: activeId }));
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.lookupMachine(activeId);
        if (cancelled) return;
        if (res.exists) {
          setLookup({ status: 'found', exists: true, machineId: activeId });
          const visual = getMachineVisual(activeId);
          setImgSrc(visual?.src || null);
          setImgLabel(visual?.label || '');
        } else {
          setLookup({ status: 'not-found', exists: false, machineId: activeId });
          setImgSrc(null);
          setImgLabel('');
        }
      } catch {
        if (!cancelled) {
          setLookup({ status: 'not-found', exists: false, machineId: activeId });
          setImgSrc(null);
          setImgLabel('');
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeId]);

  const handleRefresh = () => {
    setImgSrc(null);
    setImgLabel('');
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const id = machineInput.trim();
    if (!id) return;
    if (lookup.status === 'not-found') return;
    if (lookup.status !== 'found') {
      try {
        const res = await api.lookupMachine(id);
        if (!res.exists) {
          setLookup({ status: 'not-found', exists: false, machineId: id });
          setImgSrc(null);
          setImgLabel('');
          return;
        }
        setLookup({ status: 'found', exists: true, machineId: id });
        const visual = getMachineVisual(id);
        setImgSrc(visual?.src || null);
        setImgLabel(visual?.label || '');
      } catch {
        setLookup({ status: 'not-found', exists: false, machineId: id });
        setImgSrc(null);
        setImgLabel('');
        return;
      }
    }
    await onSubmit(event);
  };

  const recommendation = result
    ? (result.risk || '').toUpperCase() === 'HIGH'
      ? 'Schedule immediate inspection and preventive maintenance before continuing operation.'
      : (result.risk || '').toUpperCase() === 'MEDIUM'
        ? 'Monitor sensor trends closely and plan a maintenance check during the next scheduled window.'
        : 'Operating within normal parameters. Continue routine scheduled monitoring.'
    : '';

  return <>
    <PageHeading
      eyebrow="OPERATIONS / PREDICTION"
      title="New assessment"
      description="Submit a live sensor reading for failure-risk analysis."
      action={<button type="button" className="button button-secondary" onClick={handleRefresh}><RefreshCw size={15} /> Refresh</button>}
    />
    <div className="assessment-layout">
      <form className="surface assessment-form" onSubmit={handleFormSubmit}>
        <div className="form-section-title"><span className="step-number">01</span><div><h2>Machine details</h2><p>Identify the equipment and current operating conditions.</p></div></div>
        <label className="field field-wide">
          <span>Machine identifier</span>
          <input
            name="machineId"
            required
            maxLength="80"
            value={machineInput}
            onChange={(event) => setMachineInput(event.target.value)}
          />
          <small>Use the ID shown on the equipment register.</small>
        </label>
        <div className="form-divider" />
        <div className="form-section-title"><span className="step-number">02</span><div><h2>Sensor readings</h2><p>Enter the latest measurements from the machine.</p></div></div>
        <div className="field-grid">
          <NumberField name="airTemp" label="Air temperature" unit="K" />
          <NumberField name="processTemp" label="Process temperature" unit="K" />
          <NumberField name="rotationalSpeed" label="Rotational speed" unit="RPM" />
          <NumberField name="torque" label="Torque" unit="Nm" />
          <NumberField name="toolWear" label="Tool wear" unit="min" />
        </div>
        <div className="form-actions">
          <span><ShieldAlert size={15} /> Values are stored with the assessment.</span>
          <button className="button button-primary" disabled={busy || lookup.status === 'not-found'}>
            <Activity size={16} />{busy ? 'Assessing…' : 'Run assessment'}<ArrowRight size={15} />
          </button>
        </div>
      </form>

      <aside className="surface result-panel">
        <div className="eyebrow">ASSESSMENT RESULT</div>
        {lookup.status === 'not-found' && !result && (
          <div className="inline-message inline-error" style={{ marginTop: '14px', textAlign: 'left' }}>
            <ShieldAlert size={15} />
            <span>Machine ID not found.</span>
          </div>
        )}
        {imgSrc && (
          <div className="result-machine-preview">
            <img
              src={imgSrc}
              alt={imgLabel || `Machine ${lookup.machineId || result?.machineId || ''}`}
              onError={() => {
                if (imgSrc !== '/images/equipment-sensor.jpg') {
                  setImgSrc('/images/equipment-sensor.jpg');
                } else {
                  setImgSrc(null);
                  setImgLabel('');
                }
              }}
            />
            {imgLabel && <span>{imgLabel}</span>}
          </div>
        )}
        {result ? (
          <>
            <div className={`result-gauge result-${(result.risk || 'LOW').toLowerCase()}`} style={{ '--gauge': `${Math.min(Number(result.failureProbability) || 0, 100)}%` }}><div className="gauge-ring"><strong>{Number(result.failureProbability || 0).toFixed(1)}<small>%</small></strong><span>FAILURE PROBABILITY</span></div></div>
            <RiskBadge risk={result.risk} />
            <h2 className="result-title">{result.assessment}</h2>
            <p className="result-copy">Assessment for <strong>{result.machineId}</strong> has been saved.</p>
            <p className="result-recommendation">{recommendation}</p>
            <div className="anomaly-list"><h3>Sensor checks</h3>{(result.anomalies || []).length ? result.anomalies.map((anomaly) => <div className="anomaly-item" key={anomaly}><ShieldAlert size={15} />{anomaly}</div>) : <div className="anomaly-clear"><Check size={15} />No sensor anomalies detected</div>}</div>
          </>
        ) : lookup.status !== 'not-found' ? (
          <div className="result-placeholder"><div className="placeholder-icon"><Gauge size={23} /></div><h2>Awaiting readings</h2><p>Submit sensor values to see the machine’s current failure likelihood and sensor checks.</p><div className="placeholder-rule" /></div>
        ) : null}
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
      <div className="filter-bar"><div className="filter-title"><ShieldAlert size={17} /><strong>Maintenance alerts</strong><span>{filtered.length} total</span></div><label className="search-box"><Search size={15} /><input placeholder="Search by machine ID, alert type, or status" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {loading ? <div className="table-empty"><LoaderCircle className="spin" size={18} />Loading alerts</div> : !filtered.length ? <div className="table-empty">No matching alerts. Equipment signals will appear here when recorded.</div> : <div className="table-scroll"><table><thead><tr><th>TIME</th><th>MACHINE</th><th>ALERT TYPE</th><th>STATUS</th><th>DETAIL</th></tr></thead><tbody>
        {filtered.map((alert, index) => <tr key={`${alert.machineId}-${alert.time}-${index}`}><td className="mono">{alert.time}</td><td className="machine-cell"><span className="machine-avatar"><Cpu size={14} /></span>{alert.machineId}</td><td><span className="alert-type"><span />{(alert.type || 'ALERT').replace('_', ' ')}</span></td><td><span className={`state-pill ${(alert.status || 'OPEN').toLowerCase()}`}>{alert.status || 'OPEN'}</span></td><td className="alert-detail">{alert.message}</td></tr>)}
      </tbody></table></div>}
    </section>
    <div className="alert-note"><ShieldAlert size={16} /><span>Alerts are generated by the Java anomaly detector and written to the SQLite maintenance database.</span></div>
  </>;
}

function ChartEmpty({ text }) {
  return <div className="chart-empty"><Activity size={19} /><span>{text}</span></div>;
}

function DatasetPage({ onSelectMachine }) {
  const [dataset, setDataset] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dataset().then(setDataset).catch((loadError) => setError(loadError.message));
  }, []);

  const visibleHeaders = (dataset?.headers || []).filter(
    (header) => !['TWF', 'HDF', 'PWF', 'OSF', 'RNF'].includes(header.trim().toUpperCase()),
  );

  return <>
    <PageHeading eyebrow="DATA / SOURCE FILES" title="Dataset management" description="Inspect the configured AI4I dataset and validate machine records stored for the system." />
    <section className="surface dataset-info" style={{ marginBottom: '16px' }}><div className="eyebrow">CURRENT DATASET</div><h2>{dataset?.filename || 'Loading dataset…'}</h2><div className="dataset-path">{dataset?.path || 'data/ai4i2020.csv'}</div><div className="dataset-stats"><div><span>LOADED ROWS</span><strong>{dataset ? dataset.rows.toLocaleString() : '—'}</strong></div><div><span>COLUMNS</span><strong>{dataset ? dataset.columns : '—'}</strong></div></div><div className="dataset-source"><span className="source-led" />{dataset ? 'Dataset available to model training' : error ? 'Dataset could not be loaded' : 'Checking configured dataset'}</div></section>
    <section className="surface dataset-preview"><div className="surface-heading table-heading"><div><div className="eyebrow">DATA VALIDATION</div><h2>Dataset preview</h2></div><span className="table-note">{dataset ? `First ${dataset.preview.length} of ${dataset.rows.toLocaleString()} rows · click Product ID to preview machine` : 'Waiting for data'}</span></div>
      {dataset?.preview?.length ? <div className="table-scroll"><table><thead><tr>{visibleHeaders.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{dataset.preview.map((row, index) => <tr key={index}>{visibleHeaders.map((header) => <td key={header}>{header.toLowerCase().includes('product id') ? (
        <button
          type="button"
          className="product-id-link"
          onClick={() => onSelectMachine?.({
            productId: row[header],
            imageIndex: index,
            type: row.Type,
            airTemp: row['Air temperature [K]'],
            processTemp: row['Process temperature [K]'],
            rotationalSpeed: row['Rotational speed [RPM]'],
            torque: row['Torque [Nm]'],
            toolWear: row['Tool wear [min]'],
          })}
          title={`Preview machine ${row[header]}`}
        >
          <span>{row[header]}</span>
        </button>
      ) : row[header]}</td>)}</tr>)}</tbody></table></div> : <div className="table-empty">{error || 'Dataset preview is loading.'}</div>}
    </section>
  </>;
}

function ModelTraining({ model, busy, onTrain }) {
  const [trainedNotice, setTrainedNotice] = useState(null);

  const handleTrain = async () => {
    setTrainedNotice(null);
    const response = await onTrain();
    if (response) {
      setTrainedNotice(`Model training completed successfully! (${response.rows.toLocaleString()} records studied)`);
    }
  };

  return <>
    <PageHeading
      eyebrow="MODEL / TRAINING"
      title="Model Training"
      description="Teach the system to predict machine failures using past machine data."
    />

    <div className="model-layout">
      <section className="surface model-card">
        <div className="model-card-header">
          <div className="model-icon"><Cpu size={19} /></div>
          <span className={`model-state ${model.trained ? 'ready' : 'missing'}`}>
            <i />{model.trained ? 'Model Available' : 'Model Not Available'}
          </span>
        </div>

        <h2>How the model learns</h2>
        <p className="model-description">
          The system studies machine temperature, speed, torque, and tool wear to learn failure patterns.
        </p>

        {model.trained && (
          <div className="inline-message inline-success" style={{ marginTop: '14px' }}>
            <Check size={15} />
            <span>The trained model is ready to predict machine failure.</span>
          </div>
        )}

        <div className="beginner-facts">
          <div className="beginner-fact-card">
            <div className="beginner-fact-head"><span>Algorithm</span><strong>Random Forest</strong></div>
            <p>Uses multiple decision trees to predict machine failure.</p>
          </div>
          <div className="beginner-fact-card">
            <div className="beginner-fact-head"><span>Training Data</span><strong>AI4I 2020 Machine Dataset</strong></div>
            <p>AI4I 2020 Machine Dataset – contains machine readings and failure records.</p>
          </div>
        </div>

        <p className="train-helper-copy">Train the model using available machine data.</p>
        {busy && <div className="training-progress"><span /><span /></div>}
        {trainedNotice && (
          <div className="inline-message inline-success" style={{ marginTop: '12px' }}>
            <Check size={15} />
            <span>{trainedNotice}</span>
          </div>
        )}
        <div className="model-actions">
          <button className="button button-primary" onClick={handleTrain} disabled={busy}>
            {busy ? <><LoaderCircle size={16} className="spin" /> Training model...</> : <><Activity size={16} /> Train the Model <ArrowRight size={15} /></>}
          </button>
        </div>
      </section>

      <section className="surface model-side-panel">
        <div className="eyebrow">PREDICTION</div>
        <h2>Machine Failure Prediction</h2>
        <img
          src="/images/equipment-sensor.jpg"
          alt="Industrial rotary motor with predictive sensor module"
          style={{ width: '100%', maxWidth: '210px', height: '165px', objectFit: 'contain', borderRadius: '10px', margin: '12px auto 14px', border: '1px solid #e2e8f0', background: '#f8fafc', padding: '6px' }}
        />
        <p>Predicts possible machine failures using machine operating conditions.</p>
        <div className="saved-model-box">
          <div className="artifact-status">
            <span className={model.trained ? 'dot-ready' : ''} />
            <strong>{model.trained ? 'Saved Model Available' : 'Training Required'}</strong>
          </div>
        </div>
      </section>
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

const MACHINE_GALLERY = [
  { src: '/images/machines/machine-h.png', title: 'Horizontal CNC Machining Center' },
  { src: '/images/machines/machine-m.jpg', title: 'Vertical CNC Milling Machine' },
  { src: '/images/machines/machine-l.png', title: 'Precision Industrial Lathe' },
  { src: '/images/machines/machine-4.png', title: 'Automated Assembly & Pick-and-Place Unit' },
  { src: '/images/machines/machine-5.png', title: 'Automated Bagging & Conveyor System' },
  { src: '/images/machines/machine-6.jpg', title: 'Multi-Head Weigher & Packaging Line' },
  { src: '/images/equipment-sensor.jpg', title: 'Industrial Rotary Motor & Turbine Assembly' },
];

const assignedMachineImages = new Map();

function getMachineVisual(productId, explicitType, imageIndex) {
  const id = String(productId || '').trim().toUpperCase();
  if (!id) return null;

  if (typeof imageIndex === 'number' && imageIndex >= 0) {
    const item = MACHINE_GALLERY[imageIndex % MACHINE_GALLERY.length];
    assignedMachineImages.set(id, item);
    return { src: item.src, label: `${item.title} (${id})` };
  }

  if (assignedMachineImages.has(id)) {
    const item = assignedMachineImages.get(id);
    return { src: item.src, label: `${item.title} (${id})` };
  }

  const nextItem = MACHINE_GALLERY[assignedMachineImages.size % MACHINE_GALLERY.length];
  assignedMachineImages.set(id, nextItem);
  return { src: nextItem.src, label: `${nextItem.title} (${id})` };
}

function MachineImageModal({ machine, onClose }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [machine]);

  if (!machine) return null;
  const visual = getMachineVisual(machine.productId, machine.type, machine.imageIndex);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Machine preview ${machine.productId}`} onClick={onClose}>
      <div className="surface machine-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow">MACHINE PREVIEW</div>
            <h2>Product ID: {machine.productId}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close preview" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="modal-image-box">
          {visual && !imgFailed ? (
            <>
              <img src={visual.src} alt={`${visual.label} (${machine.productId})`} onError={() => setImgFailed(true)} />
              <span className="modal-image-caption">{visual.label}</span>
            </>
          ) : (
            <div className="modal-image-placeholder">
              <Cpu size={32} />
              <strong>No machine image available</strong>
              <small>No mapped equipment image was found for Product ID {machine.productId}.</small>
            </div>
          )}
        </div>
        <div className="modal-specs">
          {machine.airTemp !== undefined && <div><span>Air Temp</span><strong>{machine.airTemp} K</strong></div>}
          {machine.processTemp !== undefined && <div><span>Process Temp</span><strong>{machine.processTemp} K</strong></div>}
          {machine.rotationalSpeed !== undefined && <div><span>Speed</span><strong>{machine.rotationalSpeed} RPM</strong></div>}
          {machine.torque !== undefined && <div><span>Torque</span><strong>{machine.torque} Nm</strong></div>}
          {machine.toolWear !== undefined && <div><span>Tool Wear</span><strong>{machine.toolWear} min</strong></div>}
          {machine.risk && <div><span>Risk Level</span><strong>{machine.risk}</strong></div>}
          {machine.failureProbability !== undefined && <div><span>Failure Prob.</span><strong>{machine.failureProbability}</strong></div>}
          {machine.time && <div><span>Recorded</span><strong>{machine.time}</strong></div>}
        </div>
      </div>
    </div>
  );
}

function buildMachinePerformanceReport(machine, modelMetrics) {
  if (!machine) return null;
  const air = Number(machine.airTemp);
  const proc = Number(machine.processTemp);
  const speed = Number(machine.rotationalSpeed);
  const torque = Number(machine.torque);
  const wear = Number(machine.toolWear);
  const thermalDelta = Number.isFinite(proc) && Number.isFinite(air) ? proc - air : null;

  const observations = [];
  const risks = [];
  const actions = [];

  if (air > 305.0) {
    observations.push(`Elevated ambient air temperature (${air.toFixed(1)} K > 305.0 K threshold).`);
    risks.push('Thermal dissipation stress on housing and bearings.');
    actions.push('Inspect cooling fans, intake filters, and ambient ventilation.');
  }
  if (thermalDelta !== null && thermalDelta < 8.6) {
    observations.push(`Low thermal differential between process and air temperature (${thermalDelta.toFixed(1)} K).`);
    risks.push('Potential heat dissipation bottleneck (HDF-like thermal pattern).');
    actions.push('Verify coolant circulation and heat exchanger efficiency.');
  }
  if (speed < 1200 || speed > 2800) {
    observations.push(`Rotational speed outside nominal 1200–2800 RPM band (${speed.toFixed(0)} RPM).`);
    risks.push('Abnormal spindle/rotor load or drive instability.');
    actions.push('Check VFD drive parameters, shaft alignment, and belt tension.');
  }
  if (torque > 65.0) {
    observations.push(`Excessive torque load detected (${torque.toFixed(1)} Nm > 65.0 Nm threshold).`);
    risks.push('Overstrain on drivetrain and coupling components.');
    actions.push('Reduce feed load and inspect gearbox lubrication.');
  }
  if (wear > 200) {
    observations.push(`Critical tool wear accumulated (${wear.toFixed(0)} min > 200 min threshold).`);
    risks.push('High likelihood of cutting-edge degradation or tool fracture.');
    actions.push('Schedule immediate tool replacement and recalibrate offsets.');
  }

  if (!observations.length) {
    observations.push('All latest sensor readings (air/process temperature, rotational speed, torque, tool wear) fall within nominal operating thresholds.');
  }
  if (!risks.length) {
    risks.push(machine.riskCategory === 'HIGH' ? 'Random Forest model flagged elevated failure probability despite individual thresholds.' : 'No immediate threshold-based mechanical or thermal risks detected.');
  }
  if (!actions.length) {
    actions.push('Continue standard preventive monitoring and log periodic sensor readings.');
  }

  const predictionSummary = machine.failureProbability !== null && machine.failureProbability !== undefined
    ? `${machine.prediction || 'Assessed'} (${Number(machine.failureProbability).toFixed(1)}% failure probability, ${machine.riskCategory || 'N/A'} risk)`
    : 'Unavailable in database (no prediction record linked to latest reading).';

  const alertSummary = machine.totalAlerts > 0
    ? `${machine.openAlerts} open / ${machine.totalAlerts} total alert(s). Latest: ${machine.latestAlert || 'Recorded in alert log.'}`
    : 'No maintenance alerts recorded for this machine in the database.';

  return {
    machineId: machine.machineId,
    condition: `Product ${machine.machineId} has ${machine.readingCount} recorded reading(s) in SQLite (latest: ${machine.lastReadingAt || 'timestamp unavailable'}). Latest telemetry: Air Temp ${air.toFixed(1)} K, Process Temp ${proc.toFixed(1)} K, Speed ${speed.toFixed(0)} RPM, Torque ${torque.toFixed(1)} Nm, Tool Wear ${wear.toFixed(0)} min.`,
    observations,
    predictionSummary,
    alertSummary,
    modelContext: modelMetrics
      ? `Backed by Weka Random Forest (${Number(modelMetrics.accuracy).toFixed(2)}% 10-fold CV accuracy).`
      : 'Model evaluation metrics unavailable until a trained model artifact is evaluated.',
    risks,
    actions,
  };
}

function ReportsPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [aiReport, setAiReport] = useState(null);

  useEffect(() => {
    api.reports().then((data) => {
      setReport(data);
      if (data?.machines?.length) {
        setSelectedId(data.machines[0].machineId);
      }
    }).catch((loadError) => setError(loadError.message));
  }, []);

  const risks = report?.riskDistribution;
  const riskData = risks ? [
    { name: 'Low', value: risks.low, color: '#43886e' },
    { name: 'Medium', value: risks.medium, color: '#d49b43' },
    { name: 'High', value: risks.high, color: '#c9614b' },
  ] : [];
  const machines = report?.machines || [];
  const activeMachine = machines.find((item) => item.machineId === selectedId) || machines[0] || null;

  return <>
    <PageHeading eyebrow="REPORTS / PERFORMANCE" title="Performance reports" description="Review database totals, model validation, risk distribution, and AI-generated machine reports." action={<a className="button button-secondary export-button" href="/api/reports/export" download="predictive-maintenance-report.csv"><FileText size={16} /> Export CSV</a>} />
    {report ? <>
      <section className="metric-grid report-metrics"><Metric label="Total machine readings" value={report.stats.readings} icon={Activity} tone="mint" foot="Stored in SQLite" /><Metric label="Normal predictions" value={report.stats.normal} icon={Check} tone="mint" foot="LOW risk" /><Metric label="Machines at risk" value={report.stats.atRisk} icon={ArrowDownRight} tone="amber" foot="MEDIUM or HIGH risk" /><Metric label="Predicted failures" value={report.stats.predictedFailures} icon={ShieldAlert} tone="coral" foot="HIGH risk" /></section>
      <section className="dashboard-chart-grid report-charts"><div className="surface chart-panel"><div className="surface-heading"><div><div className="eyebrow">DATABASE ACTIVITY</div><h2>Readings over time</h2></div></div>{report.readingsTrend.length ? <div className="recharts-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.readingsTrend}><CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 4" /><XAxis dataKey="date" tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="readings" stroke="#43886e" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <ChartEmpty text="No readings are available to report." />}</div>
        <div className="surface chart-panel"><div className="surface-heading"><div><div className="eyebrow">RISK DISTRIBUTION</div><h2>Model predictions</h2></div></div>{riskData.some((item) => item.value > 0) ? <div className="recharts-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={riskData}><CartesianGrid vertical={false} stroke="#e9ece5" strokeDasharray="3 4" /><XAxis dataKey="name" tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#8b968d', fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" name="Predictions" radius={[3, 3, 0, 0]}>{riskData.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div> : <ChartEmpty text="No risk predictions are available to report." />}</div></section>
      <section className="surface evaluation-panel"><div className="surface-heading table-heading"><div><div className="eyebrow">MODEL VALIDATION</div><h2>Evaluation metrics</h2></div></div>{report.modelMetrics ? <div className="report-model-metrics">{[['Accuracy', `${report.modelMetrics.accuracy.toFixed(2)}%`], ['Precision', report.modelMetrics.precision.toFixed(4)], ['Recall', report.modelMetrics.recall.toFixed(4)], ['F1 score', report.modelMetrics.f1Score.toFixed(4)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div> : <div className="table-empty">Model metrics are unavailable until a trained model artifact exists.</div>}</section>

      <section className="surface ai-report-panel">
        <div className="surface-heading table-heading">
          <div>
            <div className="eyebrow">AI MACHINE DIAGNOSTICS</div>
            <h2>AI-Generated Machine Performance Report</h2>
          </div>
          {machines.length > 0 && (
            <div className="ai-report-controls">
              <select
                aria-label="Select machine for AI report"
                value={activeMachine?.machineId || ''}
                onChange={(event) => { setSelectedId(event.target.value); setAiReport(null); }}
              >
                {machines.map((item) => (
                  <option key={item.machineId} value={item.machineId}>
                    {item.machineId} ({item.readingCount} reading{item.readingCount === 1 ? '' : 's'})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="button button-primary"
                onClick={() => setAiReport(buildMachinePerformanceReport(activeMachine, report.modelMetrics))}
              >
                <Cpu size={15} /> Generate AI Report
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  const generated = aiReport || buildMachinePerformanceReport(activeMachine, report.modelMetrics);
                  if (!aiReport) setAiReport(generated);
                  downloadAiReportPdf(generated);
                }}
              >
                <Download size={15} /> Download PDF
              </button>
            </div>
          )}
        </div>
        {!machines.length ? (
          <div className="table-empty">No machine readings are stored in the SQLite database yet. Import a CSV or run an assessment to generate a machine-specific AI report.</div>
        ) : aiReport ? (
          <div className="ai-report-body">
            <div className="ai-report-block">
              <h3>1. Machine Condition ({aiReport.machineId})</h3>
              <p>{aiReport.condition}</p>
            </div>
            <div className="ai-report-block">
              <h3>2. Observed Telemetry Patterns</h3>
              <ul>{aiReport.observations.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="ai-report-block">
              <h3>3. AI Failure Prediction &amp; Maintenance Alerts</h3>
              <p><strong>Prediction:</strong> {aiReport.predictionSummary}</p>
              <p><strong>Alerts:</strong> {aiReport.alertSummary}</p>
              <p className="ai-model-note">{aiReport.modelContext}</p>
            </div>
            <div className="ai-report-block">
              <h3>4. Possible Risks &amp; Recommended Maintenance Actions</h3>
              <ul>{aiReport.risks.map((item) => <li key={item}><strong>Risk:</strong> {item}</li>)}</ul>
              <ul>{aiReport.actions.map((item) => <li key={item}><strong>Action:</strong> {item}</li>)}</ul>
            </div>
          </div>
        ) : (
          <div className="table-empty">Select a machine from the database above and click <strong>Generate AI Report</strong> to analyze its latest telemetry, predictions, and alerts.</div>
        )}
      </section>
    </> : <div className="surface table-empty">{error || <><LoaderCircle size={17} className="spin" />Generating performance report…</>}</div>}
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