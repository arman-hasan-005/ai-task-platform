import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  RiDashboardLine, RiTaskLine, RiLogoutBoxRLine,
  RiCpuLine, RiUser3Line,
} from 'react-icons/ri';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <RiCpuLine className="brand-icon" />
          <span>TaskAI</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <RiDashboardLine /> <span>Dashboard</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <RiUser3Line />
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>
          <button className="btn-icon" onClick={handleLogout} title="Logout">
            <RiLogoutBoxRLine />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrapper fade-in">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
