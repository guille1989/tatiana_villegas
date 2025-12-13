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
  other: [],
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

const steps = ['Datos base', 'Actividad y objetivo', 'Preferencias'];

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

  const normalizeActivitySelection = (activityLevel, trainingDays) => {
    const optionMatch = activityOptions.find((opt) => opt.value === activityLevel);
    if (optionMatch) return { activityLevel: optionMatch.value, trainingDays: optionMatch.trainingDays };

    const [levelKey, daysFromLevel] = String(activityLevel || '').split('_');
    const parsedDays = Number.isFinite(Number(daysFromLevel)) ? Number(daysFromLevel) : Number(trainingDays);
    const candidateValue = `${levelKey}_${parsedDays}`;
    const exact = activityOptions.find((opt) => opt.value === candidateValue);
    if (exact) return { activityLevel: exact.value, trainingDays: exact.trainingDays };

    if (['sedentary', 'light'].includes(levelKey)) {
      const fallback = activityOptions.find((opt) => opt.value.startsWith(`${levelKey}_`));
      if (fallback) return { activityLevel: fallback.value, trainingDays: fallback.trainingDays };
    }
    if (activityLevel === 'moderate') return { activityLevel: 'light_4', trainingDays: 4 };
    if (activityLevel === 'high' || activityLevel === 'athlete') return { activityLevel: 'light_6', trainingDays: 6 };
    return { activityLevel: activityOptions[0].value, trainingDays: activityOptions[0].trainingDays };
  };

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
      } catch {
        // ignore fetch error
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

  const nextStep = () => setStep((prev) => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < steps.length - 1) {
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
    <div className="profile-page">
      {/* 
      <header className="topbar">
        <div className="brand">Tatiana Nutricion</div>
        <nav className="menu">
          <a href="/perfil">Perfil</a>
          <a href="/plan">Plan</a>
          <a href="/platos">Platos</a>
          <a href="/checklist">Checklist</a>
          <button type="button" className="link-btn">Salir</button>
        </nav>
      </header>*/}

      <main className="profile-content">
        <section className="intro-card card">
          <div>
            <p className="eyebrow">Perfil nutricional</p>
            <h1>Queremos conocerte mejor</h1>
            <p className="hero-sub">
              Completa tus datos para calibrar tu plan y repartir las porciones de forma inteligente.
            </p>
          </div>
          <div className="stepper" role="tablist">
            {steps.map((title, idx) => (
              <button
                key={title}
                type="button"
                className={`step ${idx === step ? 'active' : ''}`}
                onClick={() => setStep(idx)}
                role="tab"
                aria-selected={idx === step}
              >
                <span className="step-dot" />
                <span className="step-title">{title}</span>
                <span className="step-number">{idx + 1}/{steps.length}</span>
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="card form-card">
          {step === 0 && (
            <section className="form-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Datos base</p>
                  <h3>Medidas</h3>
                  <p className="muted small">Usaremos estos datos para estimar tus necesidades.</p>
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="age">Edad</label>
                  <input
                    id="age"
                    type="number"
                    value={form.age}
                    onChange={(e) => handleChange('age', Number(e.target.value))}
                    placeholder="Ej. 30"
                  />
                  <span className="hint">En anos</span>
                </div>
                <div className="field">
                  <label htmlFor="weight">Peso</label>
                  <input
                    id="weight"
                    type="number"
                    value={form.weight}
                    onChange={(e) => handleChange('weight', Number(e.target.value))}
                    placeholder="Ej. 63"
                  />
                  <span className="hint">En kg</span>
                </div>
                <div className="field">
                  <label htmlFor="height">Altura</label>
                  <input
                    id="height"
                    type="number"
                    value={form.height}
                    onChange={(e) => handleChange('height', Number(e.target.value))}
                    placeholder="Ej. 170"
                  />
                  <span className="hint">En cm</span>
                </div>
                <div className="field">
                  <label htmlFor="sex">Sexo</label>
                  <select id="sex" value={form.sex} onChange={(e) => handleChange('sex', e.target.value)}>
                    <option value="">Selecciona</option>
                    <option value="female">Femenino</option>
                    <option value="male">Masculino</option>
                    <option value="other">Otro / Prefiero no decir</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="form-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Actividad y objetivo</p>
                  <h3>Estilo de vida</h3>
                  <p className="muted small">Selecciona tu nivel y objetivo para ajustar el plan.</p>
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="activity">Nivel de actividad</label>
                  <select id="activity" value={form.activityLevel} onChange={(e) => handleActivityChange(e.target.value)}>
                    {activityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="training">Dias de entrenamiento</label>
                  <input id="training" type="number" value={form.trainingDays} disabled />
                </div>
                <div className="field">
                  <label htmlFor="goal">Objetivo</label>
                  <select id="goal" value={form.goal} onChange={(e) => handleChange('goal', e.target.value)}>
                    <option value="muscle_gain">Aumentar masa muscular</option>
                    <option value="fat_loss">Perder grasa</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="form-section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Preferencias</p>
                  <h3>Flexibiliza tu plan</h3>
                  <p className="muted small">Excluye ingredientes y anade restricciones.</p>
                </div>
              </div>
              <div className="form-grid">
                <div className="field full-row">
                  <label>Alimentos a excluir</label>
                  <div className="chip-list">
                    {(!form.preferences.blockedFoods || form.preferences.blockedFoods.length === 0) && (
                      <span className="chip muted">Aun no seleccionas ningun ingrediente</span>
                    )}
                    {form.preferences.blockedFoods?.map((food) => (
                      <button
                        key={food}
                        type="button"
                        className="chip chip-active"
                        onClick={() => toggleFood(food)}
                      >
                        {food}
                        <span className="chip-close">x</span>
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

                <div className="field full-row">
                  <label>Restricciones (elige por categoria)</label>
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
                          {item} <span className="chip-badge">{cat}</span> <span className="chip-close">x</span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="chip-input-row">
                    <input
                      type="text"
                      placeholder="Buscar o agregar restriccion"
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
                      ))
                    }
                    {availableRestrictions
                      .filter((r) => r.category === restrictionCategory)
                      .filter((r) => r.name.toLowerCase().includes((searchRestriction || '').toLowerCase()))
                      .filter((r) => !(form.preferences.restrictionsDetail[r.category] || []).includes(r.name))
                      .length === 0 && (
                        <span className="chip muted">No hay opciones para esta categoria/busqueda</span>
                      )}
                  </div>
                </div>

              {/* 
                <div className="field full-row">
                  <label htmlFor="notes">Notas adicionales</label>
                  <textarea
                    id="notes"
                    value={form.preferences.notes}
                    onChange={(e) => handlePrefChange('notes', e.target.value)}
                    placeholder="Observaciones, horarios de comida, etc."
                  />
                </div>
                <div className="field full-row">
                  <label htmlFor="restrictions">Restricciones generales</label>
                  <textarea
                    id="restrictions"
                    value={form.preferences.restrictions}
                    onChange={(e) => handlePrefChange('restrictions', e.target.value)}
                    placeholder="Describe restricciones generales"
                  />
                </div>
                */} 
              </div>
            </section>
          )}

          <div className="actions-row">
            {step > 0 && (
              <button className="btn-secondary" type="button" onClick={prevStep} disabled={loading}>
                Anterior
              </button>
            )}
            <button className="btn-primary" type="submit" disabled={loading} style={{ marginLeft: '8px' }}>
              {step === steps.length - 1 ? (loading ? 'Guardando...' : 'Guardar y generar plan') : 'Siguiente'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default OnboardingPage;
