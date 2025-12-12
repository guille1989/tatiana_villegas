import React from 'react';

const SliderInput = ({ label, min = 0, max = 1000, step = 10, value, onChange }) => {
  return (
    <div className="form-control">
      <label>{label}: {value}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
};

export default SliderInput;
