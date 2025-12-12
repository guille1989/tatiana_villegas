import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar__brand">Tatiana Nutrición</div>
      {token ? (
        <div className="navbar__links">
          <Link to="/onboarding">Perfil</Link>
          <Link to="/plan">Plan</Link>
          <Link to="/meals">Platos</Link>
          <Link to="/checklist">Checklist</Link>
          <button onClick={handleLogout}>Salir</button>
        </div>
      ) : (
        <div className="navbar__links">
          <Link to="/login">Login</Link>
          <Link to="/register">Registro</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
