import React, { useEffect, useMemo, useState } from 'react';
import mealApi from '../api/mealApi';
import planApi from '../api/planApi';
import ingredientApi from '../api/ingredientApi';
import MealCard from '../components/MealCard';
import '../styles/pages/meals.css';

const FIXED_MENU_DAYS = 7;
const MENU_OPTIONS = [{ label: 'Menu para 7 dias', days: FIXED_MENU_DAYS }];

const MACRO_UNITS = {
  protein: 10, // g por porcion
  carbs: 15, // g por porcion
  fat: 5, // g por porcion
};

const MEAL_ZONES = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'mid_morning', label: 'Media Manana' },
  { key: 'lunch', label: 'Comida' },
  { key: 'snack', label: 'Merienda' },
  { key: 'dinner', label: 'Cena' },
];

const SHOW_INGREDIENT_SECTION = false;

const MealsPage = () => {
  const [meals, setMeals] = useState([]);
  const [plan, setPlan] = useState(null);
  const [menuDays, setMenuDays] = useState(FIXED_MENU_DAYS);
  const [dayPlan, setDayPlan] = useState(
    MEAL_ZONES.reduce((acc, z) => ({ ...acc, [z.key]: [] }), {})
  );
  const [catalogItems, setCatalogItems] = useState([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientCategory, setIngredientCategory] = useState('all');
  const [macroModal, setMacroModal] = useState({ open: false, macro: null, zone: null });
  const [templateId, setTemplateId] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [checklist, setChecklist] = useState({ startDay: '', statuses: Array(7).fill(false), weights: Array(7).fill(null) });
  const [checklistHistory, setChecklistHistory] = useState([]);
  const [congratsModal, setCongratsModal] = useState({ open: false, dayLabel: '' });

  useEffect(() => {
    const loadMeals = async () => {
      try {
        const { data } = await mealApi.list();
        const template = (data || []).find((m) => m.type === 'template' && m.isBaseTemplate);
        const regularMeals = (data || []).filter((m) => !(m.type === 'template' && m.isBaseTemplate));
        if (template?.templateDayPlan) setDayPlan(template.templateDayPlan);
        setMenuDays(FIXED_MENU_DAYS);
        if (template?._id) setTemplateId(template._id);
        if (typeof template?.locked === 'boolean') setIsLocked(template.locked);
        if (template?.checklist) {
          setChecklist({
            startDay: template.checklist.startDay || '',
            statuses: Array.isArray(template.checklist.statuses) && template.checklist.statuses.length === 7
              ? template.checklist.statuses
              : Array(7).fill(false),
            weights: Array.isArray(template.checklist.weights) && template.checklist.weights.length === 7
              ? template.checklist.weights
              : Array(7).fill(null),
          });
        }
        if (Array.isArray(template?.checklistHistory)) setChecklistHistory(template.checklistHistory);
        setMeals(regularMeals);
      } catch (err) {
        setMeals([]);
      }
    };
    const loadPlan = async () => {
      try {
        const { data } = await planApi.generate();
        setPlan(data);
      } catch (err) {
        setPlan(null);
      }
    };
    const loadCatalog = async () => {
      try {
        const { data } = await ingredientApi.listCatalog();
        const flattened = (data || []).flatMap((catDoc) =>
          (catDoc.items || []).map((item) => ({
            ...item,
            category: catDoc.category,
            portionLabel: catDoc.portionLabel,
            macrosPerPortion: catDoc.macrosPerPortion,
            itemKey: `${catDoc.category}-${item.name}`,
            kcal: item.kcalApprox ?? Math.round((item.macros?.protein || 0) * 4 + (item.macros?.carbs || 0) * 4 + (item.macros?.fat || 0) * 9),
          }))
        );
        setCatalogItems(flattened);
      } catch (err) {
        setCatalogItems([]);
      }
    };
    loadMeals();
    loadPlan();
    loadCatalog();
  }, []);

  const persistTemplate = async (
    nextDayPlan = dayPlan,
    days = FIXED_MENU_DAYS,
    nextLocked = isLocked,
    nextChecklist = checklist,
    nextHistory = checklistHistory
  ) => {
    try {
      const payload = { menuDays: days, dayPlan: nextDayPlan, locked: nextLocked, checklist: nextChecklist, checklistHistory: nextHistory };
      const { data } = await mealApi.saveTemplate(payload);
      setTemplateId(data?._id || null);
      if (typeof data?.locked === 'boolean') setIsLocked(data.locked);
      if (data?.checklist) {
        setChecklist({
          startDay: data.checklist.startDay || '',
          statuses: Array.isArray(data.checklist.statuses) && data.checklist.statuses.length === 7
            ? data.checklist.statuses
            : Array(7).fill(false),
          weights: Array.isArray(data.checklist.weights) && data.checklist.weights.length === 7
            ? data.checklist.weights
            : Array(7).fill(null),
        });
      }
      if (Array.isArray(data?.checklistHistory)) setChecklistHistory(data.checklistHistory);
    } catch (err) {
      // ignorar persistencia silenciosa
    }
  };

  const availableCategories = useMemo(() => {
    const categories = new Set(catalogItems.map((i) => i.category || 'otros'));
    return ['all', ...Array.from(categories)];
  }, [catalogItems]);

  const dayTotals = useMemo(() => {
    const flatEntries = Object.values(dayPlan).flat();
    return flatEntries.reduce(
      (acc, entry) => {
        const count = entry.count || 1;
        if (entry.type === 'meal') {
          acc.kcal += (entry.payload?.totals?.kcal || 0) * count;
          acc.carbs += (entry.payload?.totals?.carbs || 0) * count;
          acc.protein += (entry.payload?.totals?.protein || 0) * count;
          acc.fat += (entry.payload?.totals?.fat || 0) * count;
        } else if (entry.type === 'ingredient') {
          const macros = entry.payload?.macros || {};
          acc.carbs += (macros.carbs || 0) * count;
          acc.protein += (macros.protein || 0) * count;
          acc.fat += (macros.fat || 0) * count;
          acc.kcal += (entry.payload?.kcal || Math.round((macros.protein || 0) * 4 + (macros.carbs || 0) * 4 + (macros.fat || 0) * 9)) * count;
        }
        return acc;
      },
      { kcal: 0, carbs: 0, protein: 0, fat: 0 }
    );
  }, [dayPlan]);

  const planPortionTargets = useMemo(() => {
    const map = {};
    (plan?.mealPortions || []).forEach((mp) => {
      const key = mp.key;
      map[key] = {
        protein: (Number(mp.leanProtein) || 0) + (Number(mp.fattyProtein) || 0),
        carbs: Number(mp.carbs) || 0,
        fats: (Number(mp.fats) || 0) + (Number(mp.fattyProtein) || 0),
      };
    });
    return map;
  }, [plan]);

  const defaultPortionTargets = useMemo(
    () => ({
      protein: plan ? (plan.protein || 0) / MACRO_UNITS.protein : 0,
      carbs: plan ? (plan.carbs || 0) / MACRO_UNITS.carbs : 0,
      fats: plan ? (plan.fat || 0) / MACRO_UNITS.fat : 0,
    }),
    [plan]
  );

  const normalizeMacroKey = (macro) => (macro === 'fat' ? 'fats' : macro);

  const getTargetForMacro = (zoneKey, macro) => {
    const key = normalizeMacroKey(macro);
    const zone = planPortionTargets[zoneKey];
    if (zone && zone[key] !== undefined) return zone[key];
    return defaultPortionTargets[key] || 0;
  };

  const macroPortionsFromEntry = (entry) => {
    const count = entry.count || 1;
    if (entry.type === 'meal') {
      const totals = entry.payload?.totals || {};
      return {
        protein: ((totals.protein || 0) * count) / MACRO_UNITS.protein,
        carbs: ((totals.carbs || 0) * count) / MACRO_UNITS.carbs,
        fats: ((totals.fat || 0) * count) / MACRO_UNITS.fat,
      };
    }
    const macros = entry.payload?.macros || {};
    return {
      protein: ((macros.protein || 0) * count) / MACRO_UNITS.protein,
      carbs: ((macros.carbs || 0) * count) / MACRO_UNITS.carbs,
      fats: ((macros.fat || 0) * count) / MACRO_UNITS.fat,
    };
  };

  const zoneMacroUsage = (zoneKey) => {
    const entries = dayPlan[zoneKey] || [];
    return entries.reduce(
      (acc, entry) => {
        const m = macroPortionsFromEntry(entry);
        return {
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fats: acc.fats + m.fats,
        };
      },
      { protein: 0, carbs: 0, fats: 0 }
    );
  };

  const macroRemaining = (macro, zoneKey) => {
    const key = normalizeMacroKey(macro);
    const target = getTargetForMacro(zoneKey, key);
    const current = zoneMacroUsage(zoneKey)[key] || 0;
    const remaining = Math.max(0, Math.round((target - current) * 10) / 10);
    return { remaining, portions: Math.max(0, Math.floor(remaining)) };
  };

  const isMacroComplete = (macro, zoneKey) => macroRemaining(macro, zoneKey).portions <= 0;
  const isZoneComplete = (zoneKey) =>
    ['protein', 'carbs', 'fat'].every((m) => {
      const target = getTargetForMacro(zoneKey, m);
      if (target <= 0) return true;
      return macroRemaining(m, zoneKey).portions <= 0;
    });
  const isAllComplete = MEAL_ZONES.every((z) => isZoneComplete(z.key));
  const weekCompleted = useMemo(() => checklist.statuses.every((s) => s), [checklist.statuses]);

  const macroTypeForIngredient = (ing) => {
    const macros = ing.macros || {};
    const scores = [
      { key: 'protein', value: macros.protein || 0 },
      { key: 'carbs', value: macros.carbs || 0 },
      { key: 'fat', value: macros.fat || 0 },
    ].sort((a, b) => b.value - a.value);
    return scores[0].value > 0 ? scores[0].key : 'other';
  };

  const menuTotals = useMemo(
    () => ({
      kcal: dayTotals.kcal * menuDays,
      carbs: dayTotals.carbs * menuDays,
      protein: dayTotals.protein * menuDays,
      fat: dayTotals.fat * menuDays,
    }),
    [dayTotals, menuDays]
  );

  const targets = useMemo(() => {
    if (!plan) return null;
    return {
      kcal: plan.kcal || 0,
      carbs: plan.carbs || 0,
      protein: plan.protein || 0,
      fat: plan.fat || 0,
    };
  }, [plan]);

  const describeDiff = (actual, target) => {
    if (!target) return '';
    const diff = Math.round((actual - target) * 10) / 10;
    if (Math.abs(diff) < 1) return 'En rango';
    if (diff < 0) return `Faltan ${Math.abs(diff)}g`;
    return `+${diff}g`;
  };

  const resetWeek = () => {
    const finishedWeek = {
      startDay: checklist.startDay || '',
      statuses: checklist.statuses || [],
      weights: checklist.weights || [],
      completedAt: new Date().toISOString(),
    };
    const nextHistory = [...checklistHistory, finishedWeek];
    const freshChecklist = { startDay: '', statuses: Array(7).fill(false), weights: Array(7).fill(null) };
    setChecklist(freshChecklist);
    setChecklistHistory(nextHistory);
    setIsLocked(false);
    persistTemplate(dayPlan, FIXED_MENU_DAYS, false, freshChecklist, nextHistory);
  };

  const handleDragStartMeal = (e, meal) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'meal', id: meal._id }));
  };

  const handleDragStartIngredient = (e, itemKey) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'ingredient', id: itemKey }));
  };

  const handleDrop = (zoneKey, e) => {
    if (isLocked) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (!payload?.type) return;

    if (payload.type === 'meal') {
      const meal = meals.find((m) => m._id === payload.id);
      if (!meal) return;
      setDayPlan((prev) => {
        const existingIdx = prev[zoneKey].findIndex((entry) => entry.type === 'meal' && entry.payload._id === meal._id);
        if (existingIdx >= 0) {
          const updatedZone = [...prev[zoneKey]];
          updatedZone[existingIdx] = {
            ...updatedZone[existingIdx],
            count: (updatedZone[existingIdx].count || 1) + 1,
          };
          const nextPlan = { ...prev, [zoneKey]: updatedZone };
          persistTemplate(nextPlan);
          return nextPlan;
        }
        const nextPlan = { ...prev, [zoneKey]: [...prev[zoneKey], { type: 'meal', payload: meal, count: 1 }] };
        persistTemplate(nextPlan);
        return nextPlan;
      });
    } else if (payload.type === 'ingredient') {
      const ing = catalogItems.find((i) => i.itemKey === payload.id);
      if (!ing) return;
      setDayPlan((prev) => {
        const existingIdx = prev[zoneKey].findIndex(
          (entry) => entry.type === 'ingredient' && entry.payload.itemKey === ing.itemKey
        );
        if (existingIdx >= 0) {
          const updatedZone = [...prev[zoneKey]];
          updatedZone[existingIdx] = {
            ...updatedZone[existingIdx],
            count: (updatedZone[existingIdx].count || 1) + 1,
          };
          const nextPlan = { ...prev, [zoneKey]: updatedZone };
          persistTemplate(nextPlan);
          return nextPlan;
        }
        const entry = {
          type: 'ingredient',
          payload: { ...ing, uid: `${ing.itemKey}-${Date.now()}` },
          count: 1,
        };
        const nextPlan = { ...prev, [zoneKey]: [...prev[zoneKey], entry] };
        persistTemplate(nextPlan);
        return nextPlan;
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removeFromZone = (zoneKey, entryId, entryType) => {
    if (isLocked) return;
    setDayPlan((prev) => {
      const filtered = prev[zoneKey].filter((entry) => {
        if (entryType === 'meal') return !(entry.type === 'meal' && entry.payload._id === entryId);
        return !(entry.type === 'ingredient' && entry.payload.uid === entryId);
      });
      const nextPlan = { ...prev, [zoneKey]: filtered };
      persistTemplate(nextPlan);
      return nextPlan;
    });
  };

  const addIngredientToZone = (zoneKey, ing, macroKey) => {
    if (isLocked) return;
    if (macroKey && macroRemaining(macroKey, zoneKey).portions <= 0) return;
    setDayPlan((prev) => {
      const existingIdx = prev[zoneKey].findIndex(
        (entry) => entry.type === 'ingredient' && entry.payload.itemKey === ing.itemKey
      );
      if (existingIdx >= 0) {
        const updatedZone = [...prev[zoneKey]];
        updatedZone[existingIdx] = {
          ...updatedZone[existingIdx],
          count: (updatedZone[existingIdx].count || 1) + 1,
        };
        const nextPlan = { ...prev, [zoneKey]: updatedZone };
        persistTemplate(nextPlan);
        return nextPlan;
      }
      const entry = {
        type: 'ingredient',
        payload: { ...ing, uid: `${ing.itemKey}-${Date.now()}` },
        count: 1,
      };
      const nextPlan = { ...prev, [zoneKey]: [...prev[zoneKey], entry] };
      persistTemplate(nextPlan);
      return nextPlan;
    });
  };

  const updateCount = (zoneKey, entryKey, entryType, delta) => {
    if (isLocked) return;
    setDayPlan((prev) => {
      const updatedZone = prev[zoneKey].map((entry) => {
        const isMatch =
          entryType === 'meal'
            ? entry.type === 'meal' && entry.payload._id === entryKey
            : entry.type === 'ingredient' && entry.payload.uid === entryKey;
        if (!isMatch) return entry;
        const newCount = Math.max(1, (entry.count || 1) + delta);
        return { ...entry, count: newCount };
      });
      const nextPlan = { ...prev, [zoneKey]: updatedZone };
      persistTemplate(nextPlan);
      return nextPlan;
    });
  };

  const handleChecklistToggle = (idx, label) => {
    if (isLocked) return;
    const next = [...checklist.statuses];
    const willComplete = !next[idx];
    next[idx] = willComplete;
    const nextChecklist = { ...checklist, statuses: next };
    setChecklist(nextChecklist);
    persistTemplate(dayPlan, FIXED_MENU_DAYS, isLocked, nextChecklist);
    if (willComplete) setCongratsModal({ open: true, dayLabel: label });
  };

  const openMacroModal = (zoneKey, macro) => {
    setMacroModal({ open: true, macro, zone: zoneKey });
  };

  const closeMacroModal = () => setMacroModal({ open: false, macro: null, zone: null });

  const filteredIngredientsByMacro = (macro) => {
    return catalogItems
      .filter((ing) => {
        const macros = ing.macros || {};
        if (macro === 'protein') return (macros.protein || 0) > 0 && (macros.carbs || 0) === 0 && (macros.fat || 0) === 0;
        if (macro === 'carbs') return (macros.carbs || 0) > 0 && (macros.protein || 0) === 0 && (macros.fat || 0) === 0;
        if (macro === 'fat') return (macros.fat || 0) > 0 && (macros.protein || 0) === 0 && (macros.carbs || 0) === 0;
        return false;
      })
      .filter((ing) =>
        ingredientCategory === 'all' ? true : (ing.category || 'otros') === ingredientCategory
      )
      .filter((ing) =>
        ingredientSearch ? ing.name.toLowerCase().includes(ingredientSearch.toLowerCase()) : true
      );
  };

  return (
    <div className="container">
      <h2>Planifica tus platos</h2>
      <p className="hero-sub" style={{ maxWidth: '640px' }}>
        Elige el horizonte, arma un dia base con platos e ingredientes.
      </p>

      <div className="menu-builder card">
        <div className="menu-options">
          <span className="chip">Plan fijo de {FIXED_MENU_DAYS} dias</span>
        </div>
        <div className="menu-summary">
          <div>
            <p className="eyebrow">Totales del dia base</p>
            <div className="macro-chips">
              <span className="chip">kcal: {dayTotals.kcal}</span>
              <span className="chip">C: {dayTotals.carbs}g {targets ? `(${describeDiff(dayTotals.carbs, targets.carbs)})` : ''}</span>
              <span className="chip">P: {dayTotals.protein}g {targets ? `(${describeDiff(dayTotals.protein, targets.protein)})` : ''}</span>
              <span className="chip">F: {dayTotals.fat}g {targets ? `(${describeDiff(dayTotals.fat, targets.fat)})` : ''}</span>
            </div>
          </div>
          <div>
            <p className="eyebrow">Totales para {menuDays} dias</p>
            <div className="macro-chips">
              <span className="chip">kcal: {menuTotals.kcal}</span>
              <span className="chip">C: {menuTotals.carbs}g</span>
              <span className="chip">P: {menuTotals.protein}g</span>
              <span className="chip">F: {menuTotals.fat}g</span>
            </div>
          </div>
        </div>
      </div>

      {SHOW_INGREDIENT_SECTION && (
        <>
          <h3 style={{ marginTop: '12px' }}>Ingredientes</h3>
          <div className="ingredient-toolbar">
            <input
              type="text"
              placeholder="Buscar ingrediente..."
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
            />
            <div className="filter-chips">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  className={`chip ${ingredientCategory === cat ? '' : 'muted'}`}
                  type="button"
                  onClick={() => setIngredientCategory(cat)}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </button>
              ))}
            </div>
          </div>
          <div className="ingredient-grid">
            {catalogItems.length === 0 && <p className="muted">Aun no hay ingredientes en el catalogo.</p>}
            {catalogItems
              .filter((ing) =>
                ingredientCategory === 'all' ? true : (ing.category || 'otros') === ingredientCategory
              )
              .filter((ing) =>
                ingredientSearch
                  ? ing.name.toLowerCase().includes(ingredientSearch.toLowerCase())
                  : true
              )
              .map((ing) => (
                <div
                  key={ing.itemKey}
                  className="ingredient-card card"
                  draggable
                  onDragStart={(e) => handleDragStartIngredient(e, ing.itemKey)}
                >
                  <div className="ingredient-head">
                    <span className="pill">{ing.category}</span>
                    <span className="chip muted">{ing.portionLabel || 'Porcion'}</span>
                  </div>
                  <strong>{ing.name}</strong>
                  {ing.householdMeasure && <small className="muted">Medida: {ing.householdMeasure}</small>}
                  <div className="macros" style={{ fontSize: '12px' }}>
                    <span>{ing.kcal || 0} kcal</span>
                    <span>C:{ing.macros?.carbs || 0}g</span>
                    <span>P:{ing.macros?.protein || 0}g</span>
                    <span>F:{ing.macros?.fat || 0}g</span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      <div className="menu-selected card full-bleed">
        <div className="menu-selected-head">
          <div>
            <p className="eyebrow">Dia base</p>
            <h3>Platos e ingredientes por tiempo</h3>
            <p className="hero-sub" style={{ margin: '0' }}>Replica automatica para {FIXED_MENU_DAYS} dias.</p>
          </div>
          <div className="base-actions">
            <span className="chip muted">{Object.values(dayPlan).flat().length} elementos</span>
            {weekCompleted && (
              <button
                className="btn-secondary"
                type="button"
                onClick={resetWeek}
              >
                Nueva semana
              </button>
            )}
            <button
              className={`btn-primary ${(!isAllComplete || isLocked) ? 'btn-disabled' : ''}`}
              type="button"
              disabled={!isAllComplete || isLocked}
              onClick={() => {
                setIsLocked(true);
                persistTemplate(dayPlan, menuDays, true);
              }}
            >
              {isLocked ? 'Plan bloqueado' : 'Bloquear plan'}
            </button>
          </div>
        </div>
        <div className="day-zones">
          {MEAL_ZONES.map((zone) => (
            <div
              key={zone.key}
              className="zone-card meal-container"
              onDrop={(e) => handleDrop(zone.key, e)}
              onDragOver={handleDragOver}
            >
              <div className="zone-header">
                <div className="zone-title">
                  <div className="zone-title-row">
                    <strong>{zone.label}</strong>
                    <span className="chip muted">{dayPlan[zone.key]?.length || 0} items</span>
                  </div>
                  <div className="zone-goals compact">
                    <span className="goal-badge goal-protein">P {getTargetForMacro(zone.key, 'protein')}</span>
                    <span className="goal-badge goal-carbs">C {getTargetForMacro(zone.key, 'carbs')}</span>
                    <span className="goal-badge goal-fat">F {getTargetForMacro(zone.key, 'fats')}</span>
                  </div>
                  <div className="macro-status-row">
                    <span className={`status-dot ${isMacroComplete('protein', zone.key) ? 'ok' : 'pending'}`}>
                      Proteinas {isMacroComplete('protein', zone.key) ? '✓' : ''}
                    </span>
                    <span className={`status-dot ${isMacroComplete('carbs', zone.key) ? 'ok' : 'pending'}`}>
                      Carbs {isMacroComplete('carbs', zone.key) ? '✓' : ''}
                    </span>
                    <span className={`status-dot ${isMacroComplete('fat', zone.key) ? 'ok' : 'pending'}`}>
                      Grasas {isMacroComplete('fat', zone.key) ? '✓' : ''}
                    </span>
                  </div>
                </div>
                <div className="zone-actions">
                  <button
                    type="button"
                    className={`btn-secondary ${isMacroComplete('protein', zone.key) ? 'btn-disabled' : ''}`}
                    onClick={() => {
                      if (!isMacroComplete('protein', zone.key)) openMacroModal(zone.key, 'protein');
                    }}
                  >
                    Proteinas
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary ${isMacroComplete('carbs', zone.key) ? 'btn-disabled' : ''}`}
                    onClick={() => {
                      if (!isMacroComplete('carbs', zone.key)) openMacroModal(zone.key, 'carbs');
                    }}
                  >
                    Carbs
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary ${isMacroComplete('fat', zone.key) ? 'btn-disabled' : ''}`}
                    onClick={() => {
                      if (!isMacroComplete('fat', zone.key)) openMacroModal(zone.key, 'fat');
                    }}
                  >
                    Grasas
                  </button>
                </div>
              </div>

              {(!dayPlan[zone.key] || dayPlan[zone.key].length === 0) && (
                <p className="muted small">Agrega platos o ingredientes y se agruparan por macro.</p>
              )}
              {(() => {
                const zoneEntries = dayPlan[zone.key] || [];
                const mealsEntries = zoneEntries.filter((e) => e.type === 'meal');
                const ingredientEntries = zoneEntries.filter((e) => e.type === 'ingredient');
                const proteinIngredients = ingredientEntries.filter((e) => macroTypeForIngredient(e.payload) === 'protein');
                const carbIngredients = ingredientEntries.filter((e) => macroTypeForIngredient(e.payload) === 'carbs');
                const fatIngredients = ingredientEntries.filter((e) => macroTypeForIngredient(e.payload) === 'fat');
                const renderIngredientMini = (entries, macroKey) =>
                  entries.map((entry) => {
                    const ing = entry.payload;
                    const macroParts = [];
                    if (ing.macros?.protein) macroParts.push(`${ing.macros.protein}g proteina`);
                    if (ing.macros?.carbs) macroParts.push(`${ing.macros.carbs}g carbs`);
                    if (ing.macros?.fat) macroParts.push(`${ing.macros.fat}g grasas`);
                    const portionText = ing.householdMeasure || ing.portionLabel || '1 porcion';
                    const macroFull = isMacroComplete(macroKey, zone.key);
                    return (
                      <div key={`ing-${ing.uid}`} className="ing-mini-card">
                        <div className="ing-mini-info">
                          <strong className="truncate">{ing.name}</strong>
                          <div className="muted small truncate">{portionText}</div>
                          {macroParts.length > 0 && <div className="macro-line truncate">{macroParts.join(' · ')}</div>}
                        </div>
                        <div className="ing-mini-actions">
                          <div className="counter">
                            <button type="button" onClick={() => updateCount(zone.key, ing.uid, 'ingredient', -1)}>-</button>
                            <span>{entry.count || 1}</span>
                            <button
                              type="button"
                              disabled={macroFull}
                              onClick={() => {
                                if (!macroFull) updateCount(zone.key, ing.uid, 'ingredient', 1);
                              }}
                            >
                              +
                            </button>
                          </div>
                          <button className="btn-secondary" type="button" onClick={() => removeFromZone(zone.key, ing.uid, 'ingredient')}>X</button>
                        </div>
                      </div>
                    );
                  });
                return (
                  <>
                    {mealsEntries.length > 0 && (
                      <div className="zone-meals">
                        <div className="column-title">Platos completos</div>
                        <div className="zone-list">
                          {mealsEntries.map((entry) => {
                            const meal = entry.payload;
                            return (
                              <div key={`meal-${meal._id}`} className="selected-item">
                                <div>
                                  <strong>{meal.name}</strong>
                                  <div className="macros" style={{ fontSize: '12px' }}>
                                    <span>{meal.totals?.kcal || 0} kcal</span>
                                    <span>C:{meal.totals?.carbs || 0}g</span>
                                    <span>P:{meal.totals?.protein || 0}g</span>
                                    <span>F:{meal.totals?.fat || 0}g</span>
                                  </div>
                                </div>
                                <div className="counter">
                                  <button type="button" onClick={() => updateCount(zone.key, meal._id, 'meal', -1)}>-</button>
                                  <span>{entry.count || 1}</span>
                                  <button type="button" onClick={() => updateCount(zone.key, meal._id, 'meal', 1)}>+</button>
                                  <button className="btn-secondary" type="button" onClick={() => removeFromZone(zone.key, meal._id, 'meal')}>Quitar</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="zone-columns-grid">
                      <div className="macro-col">
                        <div className="macro-col-head">
                          <span>Proteinas</span>
                          <span className="chip muted">{proteinIngredients.length}</span>
                        </div>
                        <div className="macro-body">
                          {proteinIngredients.length === 0 && <p className="muted small">Sin ingredientes</p>}
                          {proteinIngredients.length > 0 && renderIngredientMini(proteinIngredients, 'protein')}
                        </div>
                      </div>
                      <div className="macro-col">
                        <div className="macro-col-head">
                          <span>Carbs</span>
                          <span className="chip muted">{carbIngredients.length}</span>
                        </div>
                        <div className="macro-body">
                          {carbIngredients.length === 0 && <p className="muted small">Sin ingredientes</p>}
                          {carbIngredients.length > 0 && renderIngredientMini(carbIngredients, 'carbs')}
                        </div>
                      </div>
                      <div className="macro-col">
                        <div className="macro-col-head">
                          <span>Grasas</span>
                          <span className="chip muted">{fatIngredients.length}</span>
                        </div>
                        <div className="macro-body">
                          {fatIngredients.length === 0 && <p className="muted small">Sin ingredientes</p>}
                          {fatIngredients.length > 0 && renderIngredientMini(fatIngredients, 'fat')}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

    
{/*      <h3 style={{ marginTop: '12px' }}>Ideas de platos</h3>
      <div className="meal-list">
        {meals.length === 0 && <p>Aun no hay platos. Crea algunos desde el backend o seed.</p>}
        {meals.map((meal) => (
          <MealCard
            key={meal._id}
            meal={meal}
            draggable
            onDragStart={handleDragStartMeal}
            selected={!!Object.values(dayPlan).flat().find((entry) => entry.type === 'meal' && entry.payload._id === meal._id)}
          />
        ))}
      </div> */} 

      {congratsModal.open && (
        <div className="modal-backdrop" onClick={() => setCongratsModal({ open: false, dayLabel: '' })}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCongratsModal({ open: false, dayLabel: '' })}>×</button>
            <div style={{ padding: '12px' }}>
              <h3>¡Felicitaciones!</h3>
              <p>
                Marcaste como cumplido el dia {congratsModal.dayLabel}. Este dia queda bloqueado para evitar cambios.
              </p>
              <button
                className="btn-primary"
                type="button"
                onClick={() => setCongratsModal({ open: false, dayLabel: '' })}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {macroModal.open && (
        <div className="modal-backdrop" onClick={closeMacroModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeMacroModal}>×</button>
            <div className="macro-modal">
              <div className="macro-modal-head">
                <div>
                  <p className="eyebrow">Selecciona {macroModal.macro}</p>
                  <h3>Ingredientes para {MEAL_ZONES.find((z) => z.key === macroModal.zone)?.label || ''}</h3>
                  {plan && (
                    <p className="muted">
                      Puedes escoger hasta {macroRemaining(macroModal.macro, macroModal.zone).portions} porciones ({macroRemaining(macroModal.macro, macroModal.zone).remaining}g restantes) segun tu plan/tiempo.
                    </p>
                  )}
                </div>
              </div>
              <div className="ingredient-toolbar" style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Buscar por nombre o clave..."
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="ingredient-grid modal-ingredient-grid">
                {macroRemaining(macroModal.macro, macroModal.zone).portions <= 0 && (
                  <p className="muted" style={{ marginBottom: '8px' }}>Este macro ya esta completo en este tiempo.</p>
                )}
                {filteredIngredientsByMacro(macroModal.macro)
                  .filter((ing) =>
                    ingredientSearch
                      ? `${ing.name} ${ing.itemKey || ''}`.toLowerCase().includes(ingredientSearch.toLowerCase())
                      : true
                  )
                  .map((ing) => (
                  <div
                    key={ing.itemKey}
                    className="ingredient-card card"
                  >
                    <div className="ingredient-head">
                      <span className="pill">{ing.category}</span>
                      <span className="chip muted">{ing.portionLabel || 'Porcion'}</span>
                    </div>
                    <strong>{ing.name}</strong>
                    {ing.householdMeasure && <small className="muted">Medida: {ing.householdMeasure}</small>}
                    <div className="macros" style={{ fontSize: '12px' }}>
                      <span>{ing.kcal || 0} kcal</span>
                      <span>C:{ing.macros?.carbs || 0}g</span>
                      <span>P:{ing.macros?.protein || 0}g</span>
                      <span>F:{ing.macros?.fat || 0}g</span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        disabled={macroRemaining(macroModal.macro, macroModal.zone).portions <= 0}
                        onClick={() => addIngredientToZone(macroModal.zone, ing, macroModal.macro)}
                      >
                        {macroRemaining(macroModal.macro, macroModal.zone).portions <= 0 ? 'Completo' : 'Agregar'}
                      </button>
                      <span className="muted small">
                        Restan {macroRemaining(macroModal.macro, macroModal.zone).portions} porciones
                      </span>
                    </div>
                  </div>
                ))}
                {filteredIngredientsByMacro(macroModal.macro)
                  .filter((ing) =>
                    ingredientSearch
                      ? `${ing.name} ${ing.itemKey || ''}`.toLowerCase().includes(ingredientSearch.toLowerCase())
                      : true
                  )
                  .length === 0 && (
                  <p className="muted">No hay ingredientes para este filtro.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealsPage;
