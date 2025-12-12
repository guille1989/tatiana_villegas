import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import mealApi from '../api/mealApi';
import '../styles/pages/meals.css';

const MealDetailPage = () => {
  const { id } = useParams();
  const [meal, setMeal] = useState(null);
  const [ingredients, setIngredients] = useState([]);

  const load = async () => {
    try {
      const { data } = await mealApi.detail(id);
      console.log(data);
      setMeal(data);
      setIngredients(data.ingredients || []);
    } catch (err) {
      setMeal(null);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleChangeAlternative = async (index, altIndex) => {
    const alt = ingredients[index].alternatives?.[altIndex];
    if (!alt) return;
    const updated = ingredients.map((ing, idx) => (idx === index ? { ...alt, alternatives: ing.alternatives, meal: ing.meal } : ing));
    setIngredients(updated);
    const { data } = await mealApi.updateIngredients(id, updated);
    setMeal(data);
    setIngredients(data.ingredients || updated);
  };

  if (!meal) return <div className="container"><p>Cargando...</p></div>;

  return (
    <div className="container">
      <h2>{meal.name}</h2>
      <p className="pill">{meal.type}</p>
      <div className="macros">
        <span>{meal.totals?.kcal || 0} kcal</span>
        <span>C:{meal.totals?.carbs || 0}g</span>
        <span>P:{meal.totals?.protein || 0}g</span>
        <span>F:{meal.totals?.fat || 0}g</span>
      </div>
      <div className="card">
        <h4>Ingredientes</h4>
        {ingredients.map((ing, idx) => (
          <div key={idx} className="ingredient-row">
            <div>
              <strong>{ing.name}</strong> - {ing.quantity} {ing.unit}
              <div className="macros" style={{ fontSize: '12px' }}>
                <span>{ing.kcal || 0} kcal</span>
                <span>C:{ing.carbs || 0}g</span>
                <span>P:{ing.protein || 0}g</span>
                <span>F:{ing.fat || 0}g</span>
              </div>
            </div>
            {ing.alternatives && ing.alternatives.length > 0 && (
              <select className="alt-select" onChange={(e) => handleChangeAlternative(idx, Number(e.target.value))} defaultValue="">
                <option value="" disabled>Cambiar</option>
                {ing.alternatives.map((alt, aIdx) => (
                  <option key={aIdx} value={aIdx}>{alt.name} ({alt.kcal} kcal)</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MealDetailPage;
