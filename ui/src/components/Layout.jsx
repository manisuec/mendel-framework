import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/',            label: 'Dashboard',   icon: '\u25A6' },
  { to: '/experiments', label: 'Experiments', icon: '\u2697' },
  { to: '/layers',      label: 'Layers',      icon: '\u2630' },
];

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">{'\u2697'}</span>
          <span>Experiments</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item--active' : ''}`
              }
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
