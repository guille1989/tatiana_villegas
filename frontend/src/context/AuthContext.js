import React, { createContext, useContext, useEffect, useState } from 'react';
import authApi from '../api/authApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [hasProfile, setHasProfile] = useState(localStorage.getItem('hasProfile') === 'true');

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  const handleAuth = (data) => {
    setToken(data.token);
    setUser(data.user);
    setHasProfile(!!data.hasProfile);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('hasProfile', (!!data.hasProfile).toString());
  };

  const login = async (email, password) => {
    const { data } = await authApi.login({ email, password });
    handleAuth(data);
    return data;
  };

  const register = async (email, password) => {
    const { data } = await authApi.register({ email, password });
    handleAuth({ ...data, hasProfile: false });
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setHasProfile(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('hasProfile');
  };

  return (
    <AuthContext.Provider value={{ token, user, hasProfile, login, register, logout, setHasProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
