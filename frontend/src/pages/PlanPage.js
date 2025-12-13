import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import planApi from '../api/planApi';
import '../styles/pages/plan.css';

const BASE_MEAL_PORTIONS = [
  { key: 'breakfast', label: 'Desayuno', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'mid_morning', label: 'Media Manana', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'lunch', label: 'Comida', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'snack', label: 'Merienda', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
  { key: 'dinner', label: 'Cena', portions: 0, leanProtein: 0, fattyProtein: 0, carbs: 0, fats: 0 },
];

const ceilPortion = (value, base = 0) => {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) return Math.ceil(num);
  const baseNum = Number(base);
  if (Number.isFinite(baseNum) && baseNum >= 0) return Math.ceil(baseNum);
  return 0;
};

const mergeMealPortions = (portions = []) => {
  const base = BASE_MEAL_PORTIONS.reduce((acc, portion) => {
    acc[portion.key] = { ...portion };
    return acc;
  }, {});

  portions.forEach((portion) => {
    if (!portion?.key || !base[portion.key]) return;
    const numeric = ceilPortion(portion.portions, base[portion.key].portions);
    const leanProtein = ceilPortion(portion.leanProtein, base[portion.key].leanProtein);
    const fattyProtein = ceilPortion(portion.fattyProtein, base[portion.key].fattyProtein);
    const carbs = ceilPortion(portion.carbs, base[portion.key].carbs);
    const fatsValue = ceilPortion(portion.fats, base[portion.key].fats);
    const fatsExtra = Math.max(0, fatsValue);
    base[portion.key] = {
      ...base[portion.key],
      label: portion.label || base[portion.key].label,
      portions: numeric,
      leanProtein,
      fattyProtein,
      carbs,
      fats: fatsExtra,
    };
  });

  return Object.values(base);
};

const PlanPage = () => {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mealPortions, setMealPortions] = useState(mergeMealPortions());
  const [showMacroModal, setShowMacroModal] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      setLoading(true);
      try {
        const { data } = await planApi.generate();
        setPlan(data);
        setMealPortions(mergeMealPortions(data.mealPortions));
      } catch (err) {
        setPlan(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, []);

  const updateValue = async (key, value) => {
    if (!plan) return;
    const updated = { ...plan, [key]: value };
    setPlan(updated);
    try {
      const { data } = await planApi.update(plan._id, {
        kcal: updated.kcal,
        carbs: updated.carbs,
        protein: updated.protein,
        fat: updated.fat,
        mealPortions,
      });
      setPlan(data);
      setMealPortions(mergeMealPortions(data.mealPortions));
    } catch (err) {
      // simple silent handling
    }
  };

  const normalizeValue = (field, raw) => {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.ceil(num);
  };

  const getTotalFatsPortions = (portion, overrideFatty) => {
    const fatty = overrideFatty !== undefined ? overrideFatty : Number(portion.fattyProtein) || 0;
    const extraFats = Number(portion.fats) || 0;
    return extraFats + fatty;
  };

  const computeTotalsForLimits = (portionsList) =>
    portionsList.reduce(
      (acc, p) => ({
        protein: acc.protein + (Number(p.leanProtein) || 0) + (Number(p.fattyProtein) || 0),
        carbs: acc.carbs + (Number(p.carbs) || 0),
        fats: acc.fats + getTotalFatsPortions(p),
      }),
      { protein: 0, carbs: 0, fats: 0 }
    );

  const clampPortionValue = (portionsList, key, field, desired) => {
    if (!plan) return Math.max(0, desired);
    const targets = {
      protein: (plan.protein || 0) / 10,
      carbs: (plan.carbs || 0) / 15,
      fats: (plan.fat || 0) / 5,
    };
    const portion = portionsList.find((p) => p.key === key);
    if (!portion) return Math.max(0, desired);

    const totals = computeTotalsForLimits(portionsList);
    const currentValue = Number(portion[field]) || 0;
    const isIncreasing = desired > currentValue;
    if (!isIncreasing) return Math.max(0, desired);

    const clampBy = (allowedValue) => {
      if (!Number.isFinite(allowedValue)) return Math.max(0, desired);
      if (allowedValue <= currentValue) return currentValue;
      return Math.min(desired, Math.max(0, allowedValue));
    };

    if (field === 'leanProtein') {
      const fatty = Number(portion.fattyProtein) || 0;
      const otherMeals = totals.protein - (Number(portion.leanProtein) || 0) - fatty;
      const remaining = Math.max(0, targets.protein - otherMeals - fatty);
      return clampBy(remaining);
    }

    if (field === 'fattyProtein') {
      const lean = Number(portion.leanProtein) || 0;
      const otherMeals = totals.protein - lean - (Number(portion.fattyProtein) || 0);
      const remaining = Math.max(0, targets.protein - otherMeals - lean);
      return clampBy(remaining);
    }

    if (field === 'carbs') {
      const otherMeals = totals.carbs - (Number(portion.carbs) || 0);
      const remaining = Math.max(0, targets.carbs - otherMeals);
      return clampBy(remaining);
    }

    if (field === 'fats') {
      const fatty = Number(portion.fattyProtein) || 0;
      const otherMeals = totals.fats - (fatty + (Number(portion.fats) || 0));
      const remaining = Math.max(0, targets.fats - otherMeals - fatty);
      return clampBy(remaining);
    }

    return Math.max(0, desired);
  };

  const buildUpdatedPortions = (key, field, rawValue) => {
    const safeValue = normalizeValue(field, rawValue);
    const clampedValue = clampPortionValue(mealPortions, key, field, safeValue);
    return mealPortions.map((portion) =>
      portion.key === key
        ? {
            ...portion,
            [field]: clampedValue,
            portions:
              field === 'portions'
                ? clampedValue
                : (field === 'leanProtein' ? clampedValue : Number(portion.leanProtein) || 0) +
                  (field === 'fattyProtein' ? clampedValue : Number(portion.fattyProtein) || 0) +
                  (field === 'carbs' ? clampedValue : Number(portion.carbs) || 0) +
                  (field === 'fats' ? clampedValue : Number(portion.fats) || 0),
          }
        : portion
    );
  };

  const handlePortionChange = (key, value, field = 'portions') => {
    if (!plan) return;
    const updatedPortions = buildUpdatedPortions(key, field, value);
    setMealPortions(updatedPortions);
  };

  const handleSpecificPortionChange = async (key, field, value) => {
    if (!plan) return;
    const updatedPortions = buildUpdatedPortions(key, field, value);
    setMealPortions(updatedPortions);
    try {
      const { data } = await planApi.update(plan._id, {
        kcal: plan.kcal,
        carbs: plan.carbs,
        protein: plan.protein,
        fat: plan.fat,
        mealPortions: updatedPortions,
      });
      setPlan(data);
      setMealPortions(mergeMealPortions(data.mealPortions));
    } catch (err) {
      // simple silent handling
    }
  };

  if (loading || !plan) return <div className="container"><p>Generando plan...</p></div>;

  const units = {
    protein: plan.protein ? plan.protein / 10 : 0,
    carbs: plan.carbs ? plan.carbs / 15 : 0,
    fats: plan.fat ? plan.fat / 5 : 0,
  };

  const portions = mealPortions.map((portion) => {
    const lean = Number(portion.leanProtein) || 0;
    const fatty = Number(portion.fattyProtein) || 0;
    const carbsCount = Number(portion.carbs) || 0;
    const fatsCount = getTotalFatsPortions(portion);

    const proteinPortions = lean + fatty;
    const proteinGrams = proteinPortions * units.protein;
    const carbsGrams = carbsCount * units.carbs;
    const fatGrams = fatsCount * units.fats;
    const kcal = Math.round(proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9);

    return {
      ...portion,
      kcal,
      carbsGrams: Math.round(carbsGrams),
      proteinGrams: Math.round(proteinGrams),
      fatGrams: Math.round(fatGrams),
    };
  });

  const totals = {
    protein: portions.reduce((acc, p) => acc + (Number(p.leanProtein) || 0) + (Number(p.fattyProtein) || 0), 0),
    carbs: portions.reduce((acc, p) => acc + (Number(p.carbs) || 0), 0),
    fats: portions.reduce((acc, p) => acc + getTotalFatsPortions(p), 0),
  };

  const targets = {
    protein: (plan.protein || 0) / 10,
    carbs: (plan.carbs || 0) / 15,
    fats: (plan.fat || 0) / 5,
  };

  const describeDiff = (actual, target) => {
    const diff = actual - target;
    const rounded = Math.round(Math.abs(diff) * 10) / 10;
    if (Math.abs(diff) < 0.1) return { message: 'En rango', tone: 'ok' };
    if (diff < 0) return { message: `Faltan ${rounded} porciones`, tone: 'warn' };
    return { message: `+${rounded} porciones sobre el plan`, tone: 'warn' };
  };

  const portionStatuses = [
    { key: 'protein', label: 'Proteina (g/10)', actual: totals.protein, target: targets.protein },
    { key: 'carbs', label: 'Carbohidratos (g/15)', actual: totals.carbs, target: targets.carbs },
    { key: 'fats', label: 'Grasas (g/5)', actual: totals.fats, target: targets.fats },
  ].map((item) => {
    const base = describeDiff(item.actual, item.target);
    const progress = item.target > 0 ? Math.min((item.actual / item.target) * 100, 180) : 0;
    return { ...item, ...base, progress };
  });

  return (
    <div className="container">
      <div className="plan-hero card">
        <div>
          <p className="eyebrow">Tu plan diario</p>
          <h2 style={{ margin: '4px 0 8px' }}>{plan.kcal} kcal</h2>
          <p className="hero-sub">Distribuye las porciones para no quedarte corto ni excederte.</p>
          <div className="hero-actions">
            <Link to="/onboarding" className="btn-secondary">Recalcular plan</Link>
            <Link to="/meals" className="btn-primary">Ver ideas de platos</Link>
            <button className="btn-secondary" onClick={() => setShowMacroModal(true)}>Ajustar macros</button>
          </div>
        </div>
        <div className="hero-macros">
          <div className="macro-pill">
            <span>Carbohidratos</span>
            <strong>{plan.carbs} g</strong>
          </div>
          <div className="macro-pill">
            <span>Proteina</span>
            <strong>{plan.protein} g</strong>
          </div>
          <div className="macro-pill">
            <span>Grasa</span>
            <strong>{plan.fat} g</strong>
          </div>
        </div>
      </div>

      <div className="section-title"><strong>Control de porciones vs plan</strong></div>
      <div className="status-grid">
        {portionStatuses.map((s) => (
          <div key={s.key} className={`status-card ${s.tone === 'ok' ? 'status-ok' : 'status-warn'}`}>
            <div className="status-title">{s.label}</div>
            <div className="status-values">
              {s.actual.toFixed(1)} / {s.target.toFixed(1)} porciones
            </div>
            <div className="status-message">{s.message}</div>
            <div className="status-bar">
              <div className="status-bar-fill" style={{ width: `${s.progress}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="section-title"><strong>Porciones por tiempo de comida</strong></div>
      <div className="portion-table card">
        <div className="portion-row portion-head">
          <div>Tiempo</div>
          <div>Proteina Magra</div>
          <div>Proteina Grasa</div>
          <div>Carbohidratos</div>
          <div>Grasas</div>
        </div>
        {portions.map((p) => (
          <div key={p.key} className="portion-row">
            <div className="portion-label">{p.label}</div>
            <div>
              <input
                type="number"
                min="0"
                step="1"
                value={p.leanProtein}
                onChange={(e) => handlePortionChange(p.key, e.target.value, 'leanProtein')}
                onBlur={(e) => handleSpecificPortionChange(p.key, 'leanProtein', e.target.value)}
              />
              <small className="mobile-field-label">Proteina magra</small>
            </div>
            <div>
              <input
                type="number"
                min="0"
                step="1"
                value={p.fattyProtein}
                onChange={(e) => handlePortionChange(p.key, e.target.value, 'fattyProtein')}
                onBlur={(e) => handleSpecificPortionChange(p.key, 'fattyProtein', e.target.value)}
              />
              <small className="mobile-field-label">Proteina grasa</small>
            </div>
            <div>
              <input
                type="number"
                min="0"
                step="1"
                value={p.carbs}
                onChange={(e) => handlePortionChange(p.key, e.target.value, 'carbs')}
                onBlur={(e) => handleSpecificPortionChange(p.key, 'carbs', e.target.value)}
              />
              <small className="mobile-field-label">Carbohidratos</small>
            </div>
            <div>
              <input
                type="number"
                min="0"
                step="1"
                value={p.fats}
                onChange={(e) => handlePortionChange(p.key, e.target.value, 'fats')}
                onBlur={(e) => handleSpecificPortionChange(p.key, 'fats', e.target.value)}
              />
              <small className="sub-hint">Total grasas: {getTotalFatsPortions(p)}</small>
              <small className="mobile-field-label">Grasas</small>
            </div>
          </div>
        ))}
        <div className="portion-row portion-foot">
          <div className="portion-label">Total</div>
          <div>{portions.reduce((acc, p) => acc + (Number(p.leanProtein) || 0), 0)}</div>
          <div>{portions.reduce((acc, p) => acc + (Number(p.fattyProtein) || 0), 0)}</div>
          <div>{portions.reduce((acc, p) => acc + (Number(p.carbs) || 0), 0)}</div>
          <div>{portions.reduce((acc, p) => acc + (Number(p.fats) || 0), 0)}</div>
        </div>
      </div>

      {/* 
      <Link className="btn-primary" to="/meals" style={{ marginTop: '16px', display: 'inline-block' }}>Ver ideas de platos</Link>
        */}
        
      {showMacroModal && (
        <div className="modal-backdrop" onClick={() => setShowMacroModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowMacroModal(false)}>×</button>
            <div className="macro-adjust">
              <div className="macro-header">
                <div>
                  <p className="eyebrow" style={{ color: '#0f9d58' }}>Personaliza</p>
                  <h3 style={{ margin: '4px 0 6px' }}>Refina calorias y macros</h3>
                  <p className="macro-hint">Desliza para subir/bajar y guarda el plan a tu medida.</p>
                </div>
                <div className="macro-chip">Live</div>
              </div>
              <div className="macro-sliders">
                <div className="macro-row">
                  <div className="macro-label">
                    <span className="dot dot-kcal" />
                    <div>
                      <strong>Calorias</strong>
                      <small>1200 - 4000</small>
                    </div>
                  </div>
                  <div className="macro-value">{plan.kcal} kcal</div>
                  <input
                    className="macro-range"
                    type="range"
                    min="1200"
                    max="4000"
                    step="50"
                    value={plan.kcal}
                    onChange={(e) => updateValue('kcal', Number(e.target.value))}
                  />
                </div>
                <div className="macro-row">
                  <div className="macro-label">
                    <span className="dot dot-carbs" />
                    <div>
                      <strong>Carbohidratos</strong>
                      <small>50 - 600 g</small>
                    </div>
                  </div>
                  <div className="macro-value">{plan.carbs} g</div>
                  <input
                    className="macro-range"
                    type="range"
                    min="50"
                    max="600"
                    step="5"
                    value={plan.carbs}
                    onChange={(e) => updateValue('carbs', Number(e.target.value))}
                  />
                </div>
                <div className="macro-row">
                  <div className="macro-label">
                    <span className="dot dot-protein" />
                    <div>
                      <strong>Proteina</strong>
                      <small>50 - 300 g</small>
                    </div>
                  </div>
                  <div className="macro-value">{plan.protein} g</div>
                  <input
                    className="macro-range"
                    type="range"
                    min="50"
                    max="300"
                    step="5"
                    value={plan.protein}
                    onChange={(e) => updateValue('protein', Number(e.target.value))}
                  />
                </div>
                <div className="macro-row">
                  <div className="macro-label">
                    <span className="dot dot-fat" />
                    <div>
                      <strong>Grasa</strong>
                      <small>20 - 200 g</small>
                    </div>
                  </div>
                  <div className="macro-value">{plan.fat} g</div>
                  <input
                    className="macro-range"
                    type="range"
                    min="20"
                    max="200"
                    step="2"
                    value={plan.fat}
                    onChange={(e) => updateValue('fat', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanPage;
