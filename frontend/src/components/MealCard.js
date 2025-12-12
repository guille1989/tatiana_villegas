import React from 'react';
import { Link } from 'react-router-dom';

const MealCard = ({ meal, onSelect, selected, draggable, onDragStart }) => {
  const { name, type, totals = {} } = meal;
  const handleSelect = () => {
    if (onSelect) onSelect(meal);
  };

  return (
    <div
      className={`card meal-card ${selected ? 'meal-card-selected' : ''}`}
      draggable={draggable}
      onDragStart={(e) => onDragStart && onDragStart(e, meal)}
    >
      <div className="meal-card-header">
        <p className="pill">{type}</p>
        {selected && <span className="badge badge-success">En menu</span>}
      </div>
      <h3>{name}</h3>
      <div className="macros">
        <span>{totals.kcal || 0} kcal</span>
        <span>C:{totals.carbs || 0}g</span>
        <span>P:{totals.protein || 0}g</span>
        <span>F:{totals.fat || 0}g</span>
      </div>
      <div className="meal-card-actions">
        <Link to={`/meals/${meal._id}`} className="btn-secondary">Ver detalle</Link>
        {onSelect && (
          <button className={selected ? 'btn-secondary' : 'btn-primary'} type="button" onClick={handleSelect}>
            {selected ? 'Quitar del dia base' : 'Agregar al dia base'}
          </button>
        )}
      </div>
    </div>
  );
};

export default MealCard;
