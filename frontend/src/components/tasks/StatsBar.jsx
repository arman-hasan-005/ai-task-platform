import { RiCheckLine, RiCloseLine, RiLoader4Line, RiTimeLine } from 'react-icons/ri';
import './StatsBar.css';

const StatItem = ({ label, value, icon, color }) => (
  <div className="stat-item card">
    <div className="stat-icon" style={{ color, background: `${color}20` }}>{icon}</div>
    <div className="stat-info">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  </div>
);

const StatsBar = ({ stats }) => (
  <div className="stats-bar">
    <StatItem label="Total" value={stats.total} icon="∑" color="var(--accent)" />
    <StatItem label="Pending" value={stats.pending} icon={<RiTimeLine />} color="var(--pending)" />
    <StatItem label="Running" value={stats.running} icon={<RiLoader4Line />} color="var(--info)" />
    <StatItem label="Success" value={stats.success} icon={<RiCheckLine />} color="var(--success)" />
    <StatItem label="Failed" value={stats.failed} icon={<RiCloseLine />} color="var(--danger)" />
  </div>
);

export default StatsBar;
