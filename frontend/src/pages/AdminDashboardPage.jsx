import React, { useEffect, useMemo, useState } from 'react';
import adminApi from '../api/adminApi';
import '../styles/pages/admin.css';

const ranges = [
  { label: '7 dias', value: '7' },
  { label: '30 dias', value: '30' },
  { label: '90 dias', value: '90' },
];

const timeAgo = (dateStr) => {
  if (!dateStr) return 'Sin registro';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Sin registro';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} dias`;
};

const ProgressBar = ({ value }) => {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  let tone = 'bar-warn';
  if (pct >= 80) tone = 'bar-ok';
  else if (pct < 40) tone = 'bar-bad';
  return (
    <div className="progress-bar">
      <div className={`progress-fill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const KpiGrid = ({ summary }) => {
  const adherencePct = Math.round((summary?.avgAdherence || 0) * 100);
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <p className="kpi-label">Usuarios con plan</p>
        <p className="kpi-value">{summary?.totalUsersWithPlan ?? '-'}</p>
      </div>
      <div className="kpi-card">
        <p className="kpi-label">Planes bloqueados</p>
        <p className="kpi-value">{summary?.lockedPlansCount ?? '-'}</p>
        <span className="badge badge-neutral" title="Dia base bloqueado">Bloqueados</span>
      </div>
      <div className="kpi-card">
        <p className="kpi-label">Adherencia promedio</p>
        <p className="kpi-value">{Number.isFinite(adherencePct) ? `${adherencePct}%` : '-'}</p>
        <ProgressBar value={adherencePct} />
      </div>
      <div className="kpi-card">
        <p className="kpi-label">Usuarios en riesgo</p>
        <p className="kpi-value kpi-warn">{summary?.riskUsersCount ?? '-'}</p>
        <span className="badge badge-warn" title="Adherencia < 40% o sin actividad en 7 dias">En riesgo</span>
      </div>
    </div>
  );
};

const FiltersBar = ({ filters, onChange, isMobile, open, onToggle, onClear }) => {
  const handle = (key, value) => onChange({ ...filters, [key]: value, page: 1 });
  const content = (
    <div className="filters-row">
      <input
        type="text"
        placeholder="Buscar email"
        value={filters.search || ''}
        onChange={(e) => handle('search', e.target.value)}
      />
      <select value={filters.goal || ''} onChange={(e) => handle('goal', e.target.value)}>
        <option value="">Objetivo</option>
        <option value="muscle_gain">Muscle gain</option>
        <option value="fat_loss">Fat loss</option>
      </select>
      <select value={filters.planLocked || ''} onChange={(e) => handle('planLocked', e.target.value)}>
        <option value="">Plan bloqueado?</option>
        <option value="true">Si</option>
        <option value="false">No</option>
      </select>
      <select value={filters.adherenceBand || ''} onChange={(e) => handle('adherenceBand', e.target.value)}>
        <option value="">Adherencia</option>
        <option value="lt40">&lt; 40%</option>
        <option value="40-70">40-70%</option>
        <option value="gt70">&gt; 70%</option>
      </select>
      <select value={filters.range || '7'} onChange={(e) => handle('range', e.target.value)}>
        {ranges.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <button type="button" className="btn-secondary" onClick={onClear}>Limpiar</button>
    </div>
  );

  if (!isMobile) return <div className="filters-shell">{content}</div>;

  return (
    <div className="filters-shell">
      <button type="button" className="filter-toggle" onClick={onToggle}>
        {open ? 'Ocultar filtros' : 'Filtros'}
      </button>
      {open && content}
    </div>
  );
};

const UsersTable = ({ users, onDetail }) => (
  <div className="users-table">
    <div className="table-header">
      <span>Usuario</span>
      <span>Kcal</span>
      <span>Adherencia</span>
      <span>Ultima actividad</span>
      <span>Bloqueado</span>
      <span />
    </div>
    {users.map((u) => {
      const pct = Math.round((u.adherence || 0) * 100);
      let barTone = 'bar-warn';
      if (pct >= 80) barTone = 'bar-ok';
      else if (pct < 40) barTone = 'bar-bad';
      return (
        <div key={u.userId} className="table-row">
          <div className="user-cell">
            <div className="user-email">{u.email}</div>
            <div className="muted small">Objetivo: {u.goal || '-'}</div>
          </div>
          <span>{u.planKcal ?? '-'}</span>
          <div className="adherence-cell">
            <span className="muted small">{pct}%</span>
            <div className="progress-bar small">
              <div className={`progress-fill ${barTone}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span>{u.lastActivityAt ? timeAgo(u.lastActivityAt) : 'Sin registro'}</span>
          <span>
            <span className={`badge ${u.planLocked ? 'badge-neutral' : 'badge-success'}`}>
              {u.planLocked ? 'Sí' : 'No'}
            </span>
          </span>
          <button type="button" className="link-btn" onClick={() => onDetail(u.userId)}>Ver detalle ?</button>
        </div>
      );
    })}
    {users.length === 0 && <p className="muted small">Sin resultados</p>}
  </div>
);

const UserCard = ({ u, onDetail }) => {
  const pct = Math.round((u.adherence || 0) * 100);
  let barTone = 'bar-warn';
  if (pct >= 80) barTone = 'bar-ok';
  else if (pct < 40) barTone = 'bar-bad';
  return (
    <div className="user-card">
      <div className="card-row">
        <strong className="truncate">{u.email}</strong>
        <span className={`badge ${u.planLocked ? 'badge-neutral' : 'badge-success'}`}>
          {u.planLocked ? '??' : '?'}
        </span>
      </div>
      <p className="muted small">Objetivo: {u.goal || '-'}</p>
      <p className="muted small">Kcal: {u.planKcal ?? '-'}</p>
      <div className="adherence-card">
        <span className="muted small">Adherencia {pct}%</span>
        <div className="progress-bar small">
          <div className={`progress-fill ${barTone}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="muted small">Ultima actividad: {u.lastActivityAt ? timeAgo(u.lastActivityAt) : 'Sin registro'}</p>
      <button type="button" className="btn-secondary" onClick={() => onDetail(u.userId)}>
        Ver detalle
      </button>
    </div>
  );
};

const Pagination = ({ page, limit, total, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</button>
      <span>{page}/{totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente</button>
    </div>
  );
};

const AdminDashboardPage = () => {
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({ range: '7', page: 1, limit: 10 });
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 720);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchSummary = async () => {
    try {
      const { data } = await adminApi.getSummary({ range: filters.range });
      setSummary(data || {});
    } catch {
      setSummary({});
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listUsers(filters);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch {
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [filters.range]);

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  const handlePageChange = (nextPage) => setFilters((f) => ({ ...f, page: nextPage }));
  const handleDetail = (id) => { window.location.href = `/admin/users/${id}`; };

  const handleExport = async () => {
    try {
      const { data } = await adminApi.exportUsers(filters);
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'admin-users.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      // ignore
    }
  };

  const handleRefresh = () => {
    fetchSummary();
    fetchUsers();
  };

  const handleClear = () => setFilters({ range: '7', page: 1, limit: 10, search: '', goal: '', planLocked: '', adherenceBand: '' });

  return (
    <div className="admin-page">
      <header className="dashboard-header card">
        <div>
          <p className="eyebrow">Panel administrador</p>
          <h1>Dashboard de seguimiento</h1>
          <p className="muted small">Estado global de usuarios con plan activo</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={handleRefresh}>Refrescar</button>
          <button type="button" className="btn-primary" onClick={handleExport}>Exportar CSV</button>
        </div>
      </header>

      <section className="card">
        <KpiGrid summary={summary} />
      </section>

      <section className="card">
        <FiltersBar
          filters={filters}
          onChange={setFilters}
          isMobile={isMobile}
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
          onClear={handleClear}
        />
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Usuarios con plan</p>
            <h3>Listado</h3>
          </div>
        </div>
        {loading && <p className="muted">Cargando...</p>}
        {!loading && users.length === 0 && (
          <p className="muted small">Sin resultados. Prueba limpiar filtros.</p>
        )}
        {!loading && users.length > 0 && (
          <>
            {isMobile ? (
              <div className="user-cards">
                {users.map((u) => <UserCard key={u.userId} u={u} onDetail={handleDetail} />)}
              </div>
            ) : (
              <UsersTable users={users} onDetail={handleDetail} />
            )}
            <Pagination page={filters.page} limit={filters.limit} total={total} onChange={handlePageChange} />
          </>
        )}
      </section>
    </div>
  );
};

export default AdminDashboardPage;
