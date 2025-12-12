import React, { useEffect, useMemo, useState } from 'react';
import mealApi from '../api/mealApi';
import '../styles/pages/checklist.css';

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const MODAL_DEFAULT = { open: false, remaining: 0, dayLabel: '', idx: -1, weight: '', error: '' };

const ChecklistPage = () => {
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState(null);
  const [startDay, setStartDay] = useState('');
  const [statuses, setStatuses] = useState(Array(7).fill(false));
  const [weights, setWeights] = useState(Array(7).fill(null));
  const [error, setError] = useState('');
  const [congratsModal, setCongratsModal] = useState(MODAL_DEFAULT);
  const [history, setHistory] = useState([]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const { data } = await mealApi.list();
      const tpl = (data || []).find((m) => m.type === 'template' && m.isBaseTemplate);
      if (!tpl) {
        setTemplate(null);
        setError('Aun no tienes un plan base guardado.');
      } else {
        setTemplate(tpl);
        setStartDay(tpl.checklist?.startDay || '');
        setStatuses(
          Array.isArray(tpl.checklist?.statuses) && tpl.checklist.statuses.length === 7
            ? tpl.checklist.statuses
            : Array(7).fill(false)
        );
        setWeights(
          Array.isArray(tpl.checklist?.weights) && tpl.checklist.weights.length === 7
            ? tpl.checklist.weights
            : Array(7).fill(null)
        );
        setError('');
        setHistory(Array.isArray(tpl.checklistHistory) ? tpl.checklistHistory : []);
      }
    } catch {
      setTemplate(null);
      setError('No se pudo cargar la checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, []);

  const persistChecklist = async (nextStartDay = startDay, nextStatuses = statuses, nextWeights = weights, nextHistory = history) => {
    if (!template) return;
    try {
      await mealApi.saveTemplate({
        menuDays: template.menuDays || 7,
        dayPlan: template.templateDayPlan || {},
        locked: template.locked || false,
        checklist: { startDay: nextStartDay, statuses: nextStatuses, weights: nextWeights },
        checklistHistory: nextHistory,
      });
    } catch {
      // ignore errors
    }
  };

  const baseDayTotals = useMemo(() => {
    const plan = template?.templateDayPlan || {};
    const entries = Object.values(plan).flat();
    return entries.reduce(
      (acc, entry) => {
        const count = entry.count || 1;
        if (entry.type === 'meal') {
          const totals = entry.payload?.totals || {};
          acc.kcal += (totals.kcal || 0) * count;
        } else if (entry.type === 'ingredient') {
          const macros = entry.payload?.macros || {};
          const kcal = entry.payload?.kcal || Math.round((macros.protein || 0) * 4 + (macros.carbs || 0) * 4 + (macros.fat || 0) * 9);
          acc.kcal += kcal * count;
        }
        return acc;
      },
      { kcal: 0 }
    );
  }, [template]);

  const weightAverage = useMemo(() => {
    const vals = weights
      .map((w) => (w === null || w === '' ? null : Number(w)))
      .filter((n) => typeof n === 'number' && !Number.isNaN(n));
    if (!vals.length) return 0;
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 100) / 100;
  }, [weights]);

  const completedCount = useMemo(() => statuses.filter(Boolean).length, [statuses]);
  const kcalPerDay = Math.round((baseDayTotals.kcal || 0) * 100) / 100;
  const kcalAverage = completedCount > 0 ? kcalPerDay : 0;

  const orderedStatuses = useMemo(() => {
    if (!startDay || !DAYS.includes(startDay)) {
      return statuses.map((status, idx) => ({ label: DAYS[idx], status, idx }));
    }
    const startIdx = DAYS.indexOf(startDay);
    const ordered = [];
    for (let i = 0; i < 7; i += 1) {
      ordered.push({ label: DAYS[(startIdx + i) % 7], status: statuses[i], idx: i });
    }
    return ordered;
  }, [startDay, statuses]);

  const closeModal = () => setCongratsModal({ ...MODAL_DEFAULT });
  const isStartLocked = useMemo(() => !!startDay && statuses.some((s) => s), [startDay, statuses]);
  const motivationMessage = useMemo(() => {
    if (completedCount === 7) return 'Semana completada. Excelente trabajo.';
    if (completedCount >= 4) return 'Buen ritmo, sigue asi.';
    if (completedCount >= 1) return 'Buen inicio, manten el foco.';
    return 'Empieza marcando tu primer dia.';
  }, [completedCount]);
  const progressPct = Math.round((completedCount / 7) * 100);
  const weekCompleted = useMemo(() => statuses.every((s) => s), [statuses]);

  const resetWeek = () => {
    const finishedWeek = {
      startDay: startDay || '',
      statuses,
      weights,
      weeklyKcal: Math.round((baseDayTotals.kcal || 0) * 7),
      planMacros: {
        kcal: Math.round(baseDayTotals.kcal || 0),
        carbs: Math.round(baseDayTotals.carbs || 0),
        protein: Math.round(baseDayTotals.protein || 0),
        fat: Math.round(baseDayTotals.fat || 0),
      },
      completedAt: new Date().toISOString(),
    };
    const nextHistory = [...history, finishedWeek];
    const freshStatuses = Array(7).fill(false);
    const freshWeights = Array(7).fill(null);
    setStartDay('');
    setStatuses(freshStatuses);
    setWeights(freshWeights);
    setHistory(nextHistory);
    persistChecklist('', freshStatuses, freshWeights, nextHistory);
  };

  const weeklyComparisons = useMemo(() => {
    const completedWeeks = (history || []).filter(
      (w) => Array.isArray(w.statuses) && w.statuses.length === 7 && w.statuses.every(Boolean)
    );
    const sorted = completedWeeks.sort((a, b) => new Date(a.completedAt || 0) - new Date(b.completedAt || 0));
    return sorted.map((week, idx) => {
      const weightVals = (week.weights || [])
        .map((w) => (w === null || w === '' ? null : Number(w)))
        .filter((n) => typeof n === 'number' && !Number.isNaN(n));
      const avgWeight = weightVals.length ? Math.round((weightVals.reduce((a, b) => a + b, 0) / weightVals.length) * 100) / 100 : null;
      const weeklyKcal =
        typeof week.weeklyKcal === 'number' && week.weeklyKcal > 0
          ? week.weeklyKcal
          : week.planMacros?.kcal
            ? Math.round(week.planMacros.kcal * 7)
            : Math.round((baseDayTotals.kcal || 0) * 7);
      const prevWeight = idx > 0 ? (
        (sorted[idx - 1].weights || [])
          .map((w) => (w === null || w === '' ? null : Number(w)))
          .filter((n) => typeof n === 'number' && !Number.isNaN(n))
      ) : [];
      const prevAvg = prevWeight.length ? Math.round((prevWeight.reduce((a, b) => a + b, 0) / prevWeight.length) * 100) / 100 : null;
      const diff = prevAvg !== null && avgWeight !== null ? Math.round((avgWeight - prevAvg) * 100) / 100 : null;
      let status = '-';
      if (diff !== null) {
        if (diff > 0.5) status = 'Subiendo';
        else if (diff < -0.5) status = 'Bajando';
        else status = 'Estable';
      }
      const interpretation = diff === null ? '-' : status;
      return {
        label: `Semana ${idx + 1}`,
        avgWeight,
        diff,
        status,
        weeklyKcal,
        interpretation,
      };
    });
  }, [history, baseDayTotals.kcal]);

  if (loading) return <div className="container"><p>Cargando checklist...</p></div>;
  if (error) return <div className="container"><p>{error}</p></div>;
  if (!template) return <div className="container"><p>Aun no tienes un plan base guardado.</p></div>;

  return (
    <div className="container checklist-page">
      <div className="checklist-header">
        <div className="header-left">
          <p className="eyebrow">Seguimiento</p>
          <h2>Checklist semanal</h2>
          <p className="muted small">{motivationMessage || 'Empieza marcando tu primer dia.'}</p>
        </div>
        <div className="header-right">
          <label>Dia de inicio</label>
          <select
            value={startDay}
            disabled={isStartLocked}
            onChange={(e) => {
              const next = e.target.value;
              setStartDay(next);
              persistChecklist(next, statuses, weights);
            }}
          >
            <option value="">Selecciona</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
          {isStartLocked && <small className="muted">Bloqueado una vez iniciado el seguimiento.</small>}
          {weekCompleted && (
            <button className="btn-secondary" type="button" onClick={resetWeek} style={{ marginTop: '4px' }}>
              Nueva semana
            </button>
          )}
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <p className="label">Peso promedio</p>
          <h3>{weightAverage ? `${weightAverage.toFixed(2)} kg` : '—'}</h3>
          <p className="muted small">{weightAverage ? 'Promedio de dias marcados.' : 'Aun no hay registros.'}</p>
        </div>
        <div className="summary-card">
          <p className="label">Kcal promedio</p>
          <h3>{kcalAverage ? `${kcalAverage.toFixed(0)} kcal` : '—'}</h3>
          <p className="muted small">{kcalAverage ? 'Segun tu dia base.' : 'Define tu dia base para calcular.'}</p>
        </div>
        <div className="summary-card">
          <p className="label">Progreso semanal</p>
          <h3>{completedCount}/7</h3>
          <div className="progress-bar"><span className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
          <p className="muted small">{progressPct}% completado</p>
        </div>
        <div className="summary-card">
          <p className="label">Racha</p>
          <h3>{(() => {
            let current = 0; let best = 0;
            statuses.forEach((s) => { current = s ? current + 1 : 0; best = Math.max(best, current); });
            return `${best} dias`;
          })()}</h3>
          <p className="muted small">Dias consecutivos marcados.</p>
        </div>
      </div>

      <div className="weekly-card">
        <div className="weekly-head">
          <p className="eyebrow">Comparativo semanal</p>
          <h4>Seguimiento semana a semana</h4>
        </div>
        {weeklyComparisons.length === 0 ? (
          <p className="muted small">Aun no hay semanas completadas.</p>
        ) : (
          <div className="table-scroll">
            <table className="weekly-table">
              <thead>
                <tr>
                  <th>Indicador</th>
                  {weeklyComparisons.map((w) => <th key={w.label}>{w.label}</th>)}
                  <th>Interpretacion</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Peso (kg)</td>
                  {weeklyComparisons.map((w) => (
                    <td key={`${w.label}-peso`}>{w.avgWeight !== null ? w.avgWeight.toFixed(2) : '—'}</td>
                  ))}
                  <td rowSpan={3} className="interpretation-cell">
                    {weeklyComparisons.length > 0 ? (
                      weeklyComparisons[weeklyComparisons.length - 1].interpretation === '-'
                        ? 'Sin cambio'
                        : weeklyComparisons[weeklyComparisons.length - 1].interpretation
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <td>Diferencia peso</td>
                  {weeklyComparisons.map((w) => (
                    <td key={`${w.label}-diff`}>{w.diff !== null ? w.diff.toFixed(2) : '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td>Estatus actual</td>
                  {weeklyComparisons.map((w) => (
                    <td key={`${w.label}-estatus`}>
                      <span className={`badge ${w.status === 'Bajando' ? 'badge-green' : w.status === 'Subiendo' ? 'badge-amber' : 'badge-muted'}`}>
                        {w.status}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Calorias consumidas</td>
                  {weeklyComparisons.map((w) => (
                    <td key={`${w.label}-kcal`}>{w.weeklyKcal}</td>
                  ))}
                  <td className="interpretation-cell">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="checklist-grid">
        {orderedStatuses.map(({ label, status, idx }) => {
          const isDone = status;
          return (
            <div key={idx} className={`checklist-item ${isDone ? 'done' : 'pending'}`}>
              <div className="checklist-item-head">
                <strong>{label}</strong>
                {isDone ? <span className="status-icon">✔</span> : <span className="status-badge">Pendiente</span>}
              </div>
              <div className="checklist-body">
                {weights[idx] ? <p className="muted small">Peso: {weights[idx]} kg</p> : <p className="muted small">Sin peso registrado</p>}
                {isDone ? (
                  <p className="positive small">Completado</p>
                ) : (
                  <button
                    className="btn-primary full"
                    type="button"
                    disabled={!startDay}
                    onClick={() => {
                      if (!startDay) return;
                      const remaining = statuses.filter((v) => !v).length - 1;
                      setCongratsModal({
                        open: true,
                        remaining: Math.max(0, remaining),
                        dayLabel: label,
                        idx,
                        weight: weights[idx] ?? '',
                        error: '',
                      });
                    }}
                  >
                    Marcar dia
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {congratsModal.open && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>x</button>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3>Felicitaciones</h3>
                <p>
                  Marcaste como cumplido el dia {congratsModal.dayLabel}. Este boton queda bloqueado. Quedan {congratsModal.remaining} dias por cumplir.
                </p>
              </div>
              <div className="form-field">
                <label>Peso corporal del dia</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ej. 70.5"
                  value={congratsModal.weight}
                  onChange={(e) => setCongratsModal((prev) => ({ ...prev, weight: e.target.value, error: '' }))}
                />
                {congratsModal.error ? <p className="error-text">{congratsModal.error}</p> : null}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn-secondary" type="button" onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    const parsedWeight = parseFloat(congratsModal.weight);
                    if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
                      setCongratsModal((prev) => ({ ...prev, error: 'Ingresa un peso valido.' }));
                      return;
                    }
                    const nextStatuses = [...statuses];
                    const nextWeights = [...weights];
                    if (congratsModal.idx >= 0) {
                      nextStatuses[congratsModal.idx] = true;
                      nextWeights[congratsModal.idx] = parsedWeight;
                    }
                    setStatuses(nextStatuses);
                    setWeights(nextWeights);
                    persistChecklist(startDay, nextStatuses, nextWeights);
                    closeModal();
                  }}
                >
                  Guardar y bloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistPage;
