import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import profileApi from '../api/profileApi';
import planApi from '../api/planApi';
import ingredientApi from '../api/ingredientApi';
import restrictionApi from '../api/restrictionApi';
import { useAuth } from '../context/AuthContext';
import '../styles/pages/onboarding.css';

const defaultRestrictionsDetail = {
  medical: [],
  nutritional: [],
  ethical: [],
  cultural: [],
  lifestyle: [],
  intolerances: [],
};

const activityOptions = [
  { value: 'sedentary_3', label: 'Sedentario + 3 dias de entrenamiento (1.3)', trainingDays: 3 },
  { value: 'sedentary_4', label: 'Sedentario + 4 dias de entrenamiento (1.4)', trainingDays: 4 },
  { value: 'sedentary_5', label: 'Sedentario + 5 dias de entrenamiento (1.5)', trainingDays: 5 },
  { value: 'sedentary_6', label: 'Sedentario + 6 dias de entrenamiento (1.6)', trainingDays: 6 },
  { value: 'light_3', label: 'Ligeramente activo + 3 dias de entrenamiento (1.5)', trainingDays: 3 },
  { value: 'light_4', label: 'Ligeramente activo + 4 dias de entrenamiento (1.6)', trainingDays: 4 },
  { value: 'light_5', label: 'Ligeramente activo + 5 dias de entrenamiento (1.7)', trainingDays: 5 },
  { value: 'light_6', label: 'Ligeramente activo + 6 dias de entrenamiento (1.8)', trainingDays: 6 },
];

const OnboardingPage = () => {
  const [form, setForm] = useState({
    age: 30,
    weight: 70,
    height: 170,
    sex: 'female',
    activityLevel: activityOptions[0].value,
    trainingDays: activityOptions[0].trainingDays,
    goal: 'muscle_gain',
    preferences: {
      prefCarbs: true,
      prefFats: false,
      restrictions: '',
      notes: '',
      blockedFoods: [],
      restrictionsDetail: { ...defaultRestrictionsDetail },
    },
  });
  const [loading, setLoading] = useState(false);
  const [availableFoods, setAvailableFoods] = useState([]);
  const [searchFood, setSearchFood] = useState('');
  const [availableRestrictions, setAvailableRestrictions] = useState([]);
  const [searchRestriction, setSearchRestriction] = useState('');
  const [restrictionCategory, setRestrictionCategory] = useState('other');
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { setHasProfile } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await profileApi.getMe();
        if (data && Object.keys(data).length > 0) {
          setForm((prev) => {
            const normalizedActivity = normalizeActivitySelection(
              data.activityLevel ?? prev.activityLevel,
              data.trainingDays ?? prev.trainingDays
            );
            return {
              ...prev,
              ...data,
              activityLevel: normalizedActivity.activityLevel,
              trainingDays: normalizedActivity.trainingDays,
              preferences: {
                prefCarbs: data.preferences?.prefCarbs ?? prev.preferences.prefCarbs,
                prefFats: data.preferences?.prefFats ?? prev.preferences.prefFats,
                restrictions: data.preferences?.restrictions ?? prev.preferences.restrictions,
                notes: data.preferences?.notes ?? prev.preferences.notes,
                blockedFoods: data.preferences?.blockedFoods ?? prev.preferences.blockedFoods ?? [],
                restrictionsDetail: { ...defaultRestrictionsDetail, ...(data.preferences?.restrictionsDetail || {}) },
              },
            };
          });
        }
      } catch (err) {
        // ignore
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePrefChange = (key, value) => {
    setForm((prev) => ({ ...prev, preferences: { ...prev.preferences, [key]: value } }));
  };

  const normalizeActivitySelection = (activityLevel, trainingDays) => {
    const optionMatch = activityOptions.find((opt) => opt.value === activityLevel);
    if (optionMatch) {
      return { activityLevel: optionMatch.value, trainingDays: optionMatch.trainingDays };
    }

    const [levelKey, daysFromLevel] = String(activityLevel || '').split('_');
    const parsedDays = Number.isFinite(Number(daysFromLevel))
      ? Number(daysFromLevel)
      : Number(trainingDays);

    if (['sedentary', 'light'].includes(levelKey)) {
      const exactValue = `${levelKey}_${parsedDays}`;
      const exact = activityOptions.find((opt) => opt.value === exactValue);
      if (exact) return { activityLevel: exact.value, trainingDays: exact.trainingDays };

      const fallback = activityOptions.find((opt) => opt.value.startsWith(`${levelKey}_`));
      if (fallback) return { activityLevel: fallback.value, trainingDays: fallback.trainingDays };
    }

    if (activityLevel === 'moderate') return { activityLevel: 'light_4', trainingDays: 4 };
    if (activityLevel === 'high' || activityLevel === 'athlete')
      return { activityLevel: 'light_6', trainingDays: 6 };

    return { activityLevel: activityOptions[0].value, trainingDays: activityOptions[0].trainingDays };
  };

  const handleActivityChange = (value) => {
    const selected = activityOptions.find((opt) => opt.value === value);
    setForm((prev) => ({
      ...prev,
      activityLevel: value,
      trainingDays: selected?.trainingDays ?? prev.trainingDays,
    }));
  };

  useEffect(() => {
    const loadFoods = async () => {
      try {
        const { data } = await ingredientApi.list();
        const names = Array.from(new Set((data || []).filter(Boolean)));
        setAvailableFoods(names);
      } catch {
        setAvailableFoods([]);
      }
    };
    const loadRestrictions = async () => {
      try {
        const { data } = await restrictionApi.list();
        setAvailableRestrictions(data || []);
      } catch {
        setAvailableRestrictions([]);
      }
    };
    loadFoods();
    loadRestrictions();
  }, []);

  const nextStep = () => setStep((prev) => Math.min(prev + 1, 2));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleRestrictionsDetailChange = (category, value) => {
    const items = value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    setForm((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        restrictionsDetail: { ...prev.preferences.restrictionsDetail, [category]: items },
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 2) {
      nextStep();
      return;
    }
    setLoading(true);
    try {
      await profileApi.save(form);
      await planApi.generate(form);
      setHasProfile(true);
      navigate('/plan');
    } catch {
      // ignore simple error
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Datos base', 'Actividad y objetivo', 'Preferencias'];

  const toggleFood = (name) => {
    if (!name) return;
    setForm((prev) => {
      const exists = prev.preferences.blockedFoods?.includes(name);
      const blockedFoods = exists
        ? prev.preferences.blockedFoods.filter((f) => f !== name)
        : [...(prev.preferences.blockedFoods || []), name];
      return { ...prev, preferences: { ...prev.preferences, blockedFoods } };
    });
  };

  const addFromSearch = (name) => {
    const trimmed = (name || searchFood).trim();
    if (!trimmed) return;
    toggleFood(trimmed);
    setSearchFood('');
  };

  const toggleRestriction = (name, category = 'other') => {
    if (!name) return;
    setForm((prev) => {
      const current = prev.preferences.restrictionsDetail[category] || [];
      const exists = current.includes(name);
      const updated = exists ? current.filter((r) => r !== name) : [...current, name];
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          restrictionsDetail: { ...prev.preferences.restrictionsDetail, [category]: updated },
        },
      };
    });
  };

  const addRestrictionFromSearch = () => {
    const trimmed = searchRestriction.trim();
    if (!trimmed) return;
    toggleRestriction(trimmed, restrictionCategory);
    setSearchRestriction('');
  };

  return (
    <div className="container">
      <div className="onboarding-hero card">
        <div>
          <p className="eyebrow">Perfil nutricional</p>
          <h2 style={{ margin: '4px 0 6px' }}>Queremos conocerte mejor</h2>
          <p className="hero-sub">Completa tus datos para calibrar tu plan y repartir las porciones de forma inteligente.</p>
        </div>
        <div className="hero-steps">
          {steps.map((title, idx) => (
            <div key={title} className={`step-item ${idx === step ? 'active' : ''} ${idx < step ? 'completed' : ''}`}>
              <div className="step-dot" />
              <span className="step-title">{title}</span>
            </div>
          ))}
          <span className="step-label">{step + 1}/{steps.length}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="onboarding-layout">
        {step === 0 && (
          <div className="card onboarding-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">Datos base</p>
                <h3>Medidas</h3>
              </div>
            </div>
            <div className="onboarding-grid">
              <div className="form-control">
                <label>Edad</label>
                <input type="number" value={form.age} onChange={(e) => handleChange('age', Number(e.target.value))} />
              </div>
              <div className="form-control">
                <label>Peso (kg)</label>
                <input type="number" value={form.weight} onChange={(e) => handleChange('weight', Number(e.target.value))} />
              </div>
              <div className="form-control">
                <label>Altura (cm)</label>
                <input type="number" value={form.height} onChange={(e) => handleChange('height', Number(e.target.value))} />
              </div>
              <div className="form-control">
                <label>Sexo</label>
                <select value={form.sex} onChange={(e) => handleChange('sex', e.target.value)}>
                  <option value="female">Femenino</option>
                  <option value="male">Masculino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="card onboarding-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">Actividad y objetivo</p>
                <h3>Estilo de vida</h3>
              </div>
            </div>
            <div className="onboarding-grid">
              <div className="form-control">
                <label>Nivel de actividad</label>
                <select value={form.activityLevel} onChange={(e) => handleActivityChange(e.target.value)}>
                  {activityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label>Días de entrenamiento</label>
                <input type="number" value={form.trainingDays} disabled />
              </div>
              <div className="form-control">
                <label>Objetivo</label>
                <select value={form.goal} onChange={(e) => handleChange('goal', e.target.value)}>
                  <option value="muscle_gain">Aumentar masa muscular</option>
                  <option value="fat_loss">Perder grasa</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card onboarding-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">Preferencias</p>
                <h3>Flexibiliza tu plan</h3>
              </div>
            </div>
            <div className="onboarding-grid">
              <div className="form-control" style={{ gridColumn: '1 / -1' }}>
                <label>Alimentos a excluir</label>
                <div className="chip-list">
                  {(!form.preferences.blockedFoods || form.preferences.blockedFoods.length === 0) && (
                    <span className="chip muted">Aun no seleccionas ningún ingrediente</span>
                  )}
                  {form.preferences.blockedFoods?.map((food) => (
                    <button
                      key={food}
                      type="button"
                      className="chip chip-active"
                      onClick={() => toggleFood(food)}
                    >
                      {food}
                      <span className="chip-close">×</span>
                    </button>
                  ))}
                </div>
                <div className="chip-input-row">
                  <input
                    type="text"
                    placeholder="Buscar o agregar ingrediente a excluir"
                    value={searchFood}
                    onChange={(e) => setSearchFood(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFromSearch();
                      }
                    }}
                  />
                  <button className="btn-secondary" type="button" onClick={addFromSearch}>Agregar</button>
                </div>
                {searchFood && (
                  <div className="chip-suggestions">
                    {availableFoods
                      .filter((food) => !form.preferences.blockedFoods?.includes(food))
                      .filter((food) => food.toLowerCase().includes(searchFood.toLowerCase()))
                      .slice(0, 8)
                      .map((food) => (
                        <button key={food} type="button" className="chip" onClick={() => addFromSearch(food)}>
                          {food}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="form-control" style={{ gridColumn: '1 / -1' }}>
                <label>Restricciones (elige por categoría)</label>
                <div className="chip-list">
                  {Object.entries(form.preferences.restrictionsDetail || {}).every(([, arr]) => (arr || []).length === 0) && (
                    <span className="chip muted">Aun no seleccionas restricciones</span>
                  )}
                  {Object.entries(form.preferences.restrictionsDetail || {}).map(([cat, items]) =>
                    (items || []).map((item) => (
                      <button
                        key={`${cat}-${item}`}
                        type="button"
                        className="chip chip-active"
                        onClick={() => toggleRestriction(item, cat)}
                      >
                        {item} <span className="chip-badge">{cat}</span> <span className="chip-close">×</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="chip-input-row">
                  <input
                    type="text"
                    placeholder="Buscar o agregar restricción"
                    value={searchRestriction}
                    onChange={(e) => setSearchRestriction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRestrictionFromSearch();
                      }
                    }}
                  />
                  <select value={restrictionCategory} onChange={(e) => setRestrictionCategory(e.target.value)}>
                    <option value="medical">Medica</option>
                    <option value="nutritional">Nutricional</option>
                    <option value="ethical">Etica</option>
                    <option value="cultural">Cultural</option>
                    <option value="lifestyle">Estilo de vida</option>
                    <option value="intolerances">Intolerancias</option>
                    <option value="other">Otra</option>
                  </select>
                  <button className="btn-secondary" type="button" onClick={addRestrictionFromSearch}>Agregar</button>
                </div>
                <div className="chip-suggestions">
                  {availableRestrictions
                    .filter((r) => r.category === restrictionCategory)
                    .filter((r) => r.name.toLowerCase().includes((searchRestriction || '').toLowerCase()))
                    .filter((r) => !(form.preferences.restrictionsDetail[r.category] || []).includes(r.name))
                    .slice(0, 12)
                    .map((r) => (
                      <button
                        key={r._id || `${r.category}-${r.name}`}
                        type="button"
                        className="chip"
                        onClick={() => {
                          setRestrictionCategory(r.category);
                          toggleRestriction(r.name, r.category);
                          setSearchRestriction('');
                        }}
                      >
                        {r.name} <span className="chip-badge">{r.category}</span>
                      </button>
                    ))}
                  {availableRestrictions
                    .filter((r) => r.category === restrictionCategory)
                    .filter((r) => r.name.toLowerCase().includes((searchRestriction || '').toLowerCase()))
                    .filter((r) => !(form.preferences.restrictionsDetail[r.category] || []).includes(r.name))
                    .length === 0 && (
                      <span className="chip muted">No hay opciones para esta categoría/búsqueda</span>
                    )}
                </div>
              </div>

            </div>
          </div>
        )}

        <div className="actions-row">
          {step > 0 && (
            <button className="btn-secondary" type="button" onClick={prevStep} disabled={loading}>
              Anterior
            </button>
          )}
          <button className="btn-primary" type="submit" disabled={loading} style={{ marginLeft: '8px' }}>
            {step === 2 ? (loading ? 'Guardando...' : 'Guardar y generar plan') : 'Siguiente'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OnboardingPage;
