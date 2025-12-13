import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import adminApi from '../api/adminApi';
import '../styles/pages/admin.css';

const fmtDateShort = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Sin registros';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Sin registros';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Hace 1 dia';
  return `Hace ${days} dias`;
};

const AdminUserDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [range, setRange] = useState('30');
  const [showTemplate, setShowTemplate] = useState(false);
  const [viewMode, setViewMode] = useState('human'); // human | json
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [openSections, setOpenSections] = useState(new Set());

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const { data: resp } = await adminApi.getUserDetail(id, { range });
        setData(resp);
        if (!activeTab && resp?.baseTemplate) {
          const entries = Object.keys(resp.baseTemplate);
          if (entries.length) setActiveTab(entries[0]);
        }
      } catch {
        setData(null);
      }
    };
    fetchDetail();
  }, [id, range, activeTab]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const stats = (() => {
    if (!data) return {};
    const activity = Array.isArray(data.activityByDay) ? data.activityByDay : [];
    const lastActivityAt = activity.length
      ? activity.reduce((max, item) => {
          const d = new Date(item.date || 0);
          return d > max ? d : max;
        }, new Date(0))
      : null;
    const doneTotal = activity.reduce(
      (acc, item) => ({
        done: acc.done + (item.done || 0),
        total: acc.total + (item.total || 0),
      }),
      { done: 0, total: 0 }
    );
    const adherencePct = Math.round(((data.adherence || 0) * 100) || 0);
    const isRisk =
      (data.adherence || 0) < 0.4 ||
      !lastActivityAt ||
      Date.now() - lastActivityAt.getTime() > 7 * 24 * 60 * 60 * 1000;

    return { lastActivityAt, doneTotal, adherencePct, isRisk };
  })();

  const activityList = (() => {
    const list = Array.isArray(data?.activityByDay) ? data.activityByDay : [];
    return list
      .slice()
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 7);
  })();

  if (!data) return <div className="admin-page"><p>Cargando...</p></div>;

  const { user, profile, plan, planLocked, baseTemplate } = data;

  const totalMacros = (plan?.carbs || 0) + (plan?.protein || 0) + (plan?.fat || 0);
  const macroPerc = (val) => (totalMacros > 0 ? Math.round((val / totalMacros) * 100) : 0);

  const MEAL_LABELS = {
    breakfast: "Desayuno",
    mid_morning: "Media manana",
    lunch: "Comida",
    snack: "Merienda",
    dinner: "Cena",
  };

  const mealTimes = (() => {
    const tpl = data?.baseTemplate || {};
    const entries = Object.entries(tpl || {});
    if (entries.length === 0) return [];
    return entries.map(([key, list]) => ({
      key,
      label: MEAL_LABELS[key] || key,
      items: Array.isArray(list) ? list : [],
    }));
  })();

  const categoryFromEntry = (entry) => {
    if (entry?.payload?.category) return entry.payload.category;
    const macros = entry?.payload?.macros || {};
    const score = [
      { key: 'protein', val: macros.protein || 0 },
      { key: 'carbs', val: macros.carbs || 0 },
      { key: 'fat', val: macros.fat || 0 },
    ].sort((a, b) => b.val - a.val)[0];
    return score?.val ? score.key : '';
  };

  const filteredTimes = (() => {
    const term = (searchTerm || '').toLowerCase();
    return mealTimes
      .map((t) => {
        const filtered = term
          ? t.items.filter((it) =>
              (it.payload?.name || '').toLowerCase().includes(term)
            )
          : t.items;
        return { ...t, items: filtered };
      })
      .filter((t) => t.items.length > 0 || !term);
  })();

  const toggleSection = (key) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSectionsOpen = filteredTimes.every((t) => openSections.has(t.key));

  const setAllSections = (open) => {
    if (open) setOpenSections(new Set(filteredTimes.map((t) => t.key)));
    else setOpenSections(new Set());
  };

  const copyJson = () => {
    if (!data?.baseTemplate) return;
    navigator.clipboard?.writeText(JSON.stringify(data.baseTemplate, null, 2));
  };

  return (
    <div className="admin-page admin-detail">
      <header className="admin-detail-header card">
        <div className="header-main">
          <div>
            <p className="eyebrow">Detalle usuario</p>
            <h1 className="user-title">{user?.email || '---'}</h1>
            <p className="muted small">
              Ultima actividad: {timeAgo(stats.lastActivityAt || null)}
            </p>
          </div>
          <div className="chip-group">
            {planLocked && <span className="chip chip-neutral">Plan bloqueado</span>}
            {stats.isRisk && <span className="chip chip-warn">En riesgo</span>}
            {profile?.goal && <span className="chip chip-muted">Objetivo: {profile.goal}</span>}
          </div>
        </div>
        <div className="header-actions">
          <div className="range-select">
            <label htmlFor="range">Rango</label>
            <select id="range" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
            </select>
          </div>
          <div className="action-buttons">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Volver</button>
            <button type="button" className="btn-primary" onClick={() => window.alert('TODO: Exportar reporte')}>
              Exportar reporte
            </button>
          </div>
        </div>
      </header>

      <section className="kpi-grid detail-kpis">
        <div className="kpi-card">
          <p className="kpi-label">Adherencia</p>
          <div className="kpi-main">
            <span className="kpi-value">{stats.adherencePct}%</span>
            <span className="muted small">{stats.doneTotal.done}/{stats.doneTotal.total || 0} en rango</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${stats.adherencePct}%` }} />
          </div>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Plan</p>
          <div className="kpi-main">
            <span className="kpi-value">{plan?.kcal ?? '---'} kcal</span>
            <span className="muted small">P {plan?.protein ?? 0} | C {plan?.carbs ?? 0} | F {plan?.fat ?? 0}</span>
          </div>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Estado</p>
          <div className="kpi-tags">
            <span className={`chip ${planLocked ? 'chip-neutral' : 'chip-success'}`}>
              {planLocked ? 'Bloqueado' : 'Editable'}
            </span>
            <span className={`chip ${stats.isRisk ? 'chip-warn' : 'chip-success'}`}>
              {stats.isRisk ? 'En riesgo' : 'Estable'}
            </span>
          </div>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Perfil</p>
          <div className="profile-grid">
            <span>Edad: {profile?.age ?? '---'}</span>
            <span>Peso: {profile?.weight ?? '---'}</span>
            <span>Altura: {profile?.height ?? '---'}</span>
            <span>Sexo: {profile?.sex ?? '---'}</span>
          </div>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Entrenamiento</p>
          <div className="kpi-main">
            <span className="kpi-value">{profile?.trainingDays ?? '---'}</span>
            <span className="muted small">Dias por semana</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Actividad reciente</p>
            <h3>Ultimos 7 dias</h3>
          </div>
        </div>
        {activityList.length === 0 && <p className="muted small">Sin actividad</p>}
        <div className="week-grid">
          {activityList.map((d) => {
            const ratio = d.total ? d.done / d.total : 0;
            let statusClass = 'badge-gray';
            if (ratio >= 0.8) statusClass = 'badge-green';
            else if (ratio >= 0.4) statusClass = 'badge-amber';
            else statusClass = 'badge-red';
            const totalBars = (d.done || 0) + (d.skipped || 0) + (d.pending || 0);
            const pct = (val) => (totalBars > 0 ? (val / totalBars) * 100 : 0);
            return (
              <div key={d.date} className="day-card">
                <div className="day-card-head">
                  <span className="day-date">{fmtDateShort(d.date)}</span>
                  <span className={`badge ${statusClass}`}>{d.done}/{d.total || 0}</span>
                </div>
                <div className="stack-bar">
                  <span style={{ width: `${pct(d.done)}%` }} className="stack done" />
                  <span style={{ width: `${pct(d.skipped)}%` }} className="stack skipped" />
                  <span style={{ width: `${pct(d.pending)}%` }} className="stack pending" />
                </div>
                <div className="day-meta">
                  <span>OK {d.done || 0}</span>
                  <span>Skip {d.skipped || 0}</span>
                  <span>Pen {d.pending || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Plan actual</p>
            <h3>Resumen de macros</h3>
          </div>
          {baseTemplate && (
            <div className="base-day-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowTemplate((v) => !v)}>
                {showTemplate ? 'Ocultar dia base' : 'Ver dia base'}
              </button>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={`btn-secondary ${viewMode === 'human' ? 'active' : ''}`}
                  onClick={() => setViewMode('human')}
                >
                  Humano
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${viewMode === 'json' ? 'active' : ''}`}
                  onClick={() => setViewMode('json')}
                >
                  JSON
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="macro-bars-card">
          <div className="macro-line-item">
            <span>Proteina</span>
            <div className="progress-bar thin">
              <div className="progress-fill" style={{ width: `${macroPerc(plan?.protein || 0)}%` }} />
            </div>
            <span className="muted small">{plan?.protein ?? 0} g</span>
          </div>
          <div className="macro-line-item">
            <span>Carbs</span>
            <div className="progress-bar thin">
              <div className="progress-fill" style={{ width: `${macroPerc(plan?.carbs || 0)}%` }} />
            </div>
            <span className="muted small">{plan?.carbs ?? 0} g</span>
          </div>
          <div className="macro-line-item">
            <span>Grasas</span>
            <div className="progress-bar thin">
              <div className="progress-fill" style={{ width: `${macroPerc(plan?.fat || 0)}%` }} />
            </div>
            <span className="muted small">{plan?.fat ?? 0} g</span>
          </div>
        </div>

      </section>

      {showTemplate && (
        <section className="card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Plan actual - Dia base</p>
              <h3>Estructura del menu base del usuario</h3>
            </div>
            <div className="base-day-actions">
              <input
                type="text"
                placeholder="Buscar ingrediente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={copyJson}>Copiar JSON</button>
              {isMobile && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAllSections(!allSectionsOpen)}
                >
                  {allSectionsOpen ? 'Contraer todo' : 'Expandir todo'}
                </button>
              )}
            </div>
          </div>

          {viewMode === 'json' && (
            <div className="json-mode">
              <p className="muted small">Modo tecnico</p>
              <pre className="json-viewer">{JSON.stringify(baseTemplate, null, 2)}</pre>
            </div>
          )}

          {viewMode === 'human' && (
            <div className="base-day">
              {!baseTemplate && <p className="muted">Este usuario no tiene dia base disponible.</p>}

              {!isMobile && (
                <div className="time-tabs">
                  {filteredTimes.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                      onClick={() => setActiveTab(t.key)}
                    >
                      {t.label} <span className="badge badge-neutral">{t.items.length} items</span>
                    </button>
                  ))}
                </div>
              )}

              {!isMobile && filteredTimes
                .filter((t) => t.key === activeTab)
                .map((t) => (
                  <div key={t.key} className="time-panel">
                    <div className="time-head">
                      <h4>{t.label}</h4>
                      <span className="badge badge-neutral">{t.items.length} items</span>
                    </div>
                    <div className="item-grid">
                      {t.items.map((it, idx) => {
                        const p = it.payload || {};
                        const cat = categoryFromEntry(it);
                        return (
                          <div key={`${t.key}-${idx}`} className="ingredient-card-mini">
                            <div className="card-row">
                              <strong className="truncate">{p.name || 'Sin nombre'}</strong>
                              {it.count && <span className="badge badge-neutral">x{it.count}</span>}
                            </div>
                            <ul className="mini-list">
                              <li>Porcion: {p.portionGrams ? `${p.portionGrams} g` : '---'}</li>
                              <li>Medida: {p.householdMeasure || '---'}</li>
                              <li>Kcal: {p.kcalApprox ?? '---'}</li>
                              <li>
                                Macros: {p.macrosPerPortion?.protein ?? p.macros?.protein ?? 0}P | {p.macrosPerPortion?.carbs ?? p.macros?.carbs ?? 0}C | {p.macrosPerPortion?.fat ?? p.macros?.fat ?? 0}F
                              </li>
                            </ul>
                            {cat && <span className="badge badge-muted">{cat}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

              {isMobile && (
                <div className="accordion">
                  {filteredTimes.map((t) => (
                    <details
                      key={t.key}
                      open={openSections.has(t.key)}
                      onToggle={() => toggleSection(t.key)}
                    >
                      <summary>
                        <span>{t.label}</span>
                        <span className="badge badge-neutral">{t.items.length} items</span>
                      </summary>
                      <div className="item-grid">
                        {t.items.map((it, idx) => {
                          const p = it.payload || {};
                          const cat = categoryFromEntry(it);
                          return (
                            <div key={`${t.key}-${idx}`} className="ingredient-card-mini">
                              <div className="card-row">
                                <strong className="truncate">{p.name || 'Sin nombre'}</strong>
                                {it.count && <span className="badge badge-neutral">x{it.count}</span>}
                              </div>
                              <ul className="mini-list">
                                <li>Porcion: {p.portionGrams ? `${p.portionGrams} g` : '---'}</li>
                                <li>Medida: {p.householdMeasure || '---'}</li>
                                <li>Kcal: {p.kcalApprox ?? '---'}</li>
                                <li>
                                  Macros: {p.macrosPerPortion?.protein ?? p.macros?.protein ?? 0}P | {p.macrosPerPortion?.carbs ?? p.macros?.carbs ?? 0}C | {p.macrosPerPortion?.fat ?? p.macros?.fat ?? 0}F
                                </li>
                              </ul>
                              {cat && <span className="badge badge-muted">{cat}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminUserDetailPage;
