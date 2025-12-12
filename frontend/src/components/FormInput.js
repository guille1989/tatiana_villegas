import React from 'react';

const FormInput = ({ label, type = 'text', value, onChange, ...rest }) => {
  return (
    <div className="form-control">
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
};

export default FormInput;
