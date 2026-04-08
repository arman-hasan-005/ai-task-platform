import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  RiAddLine, RiRefreshLine, RiCheckLine, RiCloseLine,
  RiTimeLine, RiLoader4Line, RiBarChartLine,
} from 'react-icons/ri';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import TaskCard from '../components/tasks/TaskCard';
import StatsBar from '../components/tasks/StatsBar';
import './DashboardPage.css';

const FILTERS = ['all', 'pending', 'running', 'success', 'failed'];
const POLL_INTERVAL = 5000;

const DashboardPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const { data } = await tasksAPI.getAll(params);
      setTasks(data.data.tasks);
      setPagination(data.data.pagination);
    } catch {
      if (!silent) toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await tasksAPI.getStats();
      setStats(data.data.statusStats);
    } catch {}
  }, []);

  useEffect(() => { fetchTasks(); fetchStats(); }, [fetchTasks, fetchStats, refreshKey]);

  // Poll for running tasks
  useEffect(() => {
    const hasRunning = tasks.some(t => t.status === 'pending' || t.status === 'running');
    if (!hasRunning) return;
    const id = setInterval(() => { fetchTasks(true); fetchStats(); }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [tasks, fetchTasks, fetchStats]);

  const handleTaskCreated = () => {
    setShowModal(false);
    setRefreshKey(k => k + 1);
    toast.success('Task created and queued!');
  };

  const handleDelete = async (id) => {
    try {
      await tasksAPI.delete(id);
      setTasks(t => t.filter(x => x._id !== id));
      fetchStats();
      toast.success('Task deleted');
    } catch { toast.error('Delete failed'); }
  };

  const handleRetry = async (id) => {
    try {
      await tasksAPI.retry(id);
      fetchTasks(true);
      toast.success('Task queued for retry');
    } catch { toast.error('Retry failed'); }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="page-header">
          <h1>Task Dashboard</h1>
          <p>Monitor and manage your AI processing tasks</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setRefreshKey(k => k + 1)}>
            <RiRefreshLine /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <RiAddLine /> New Task
          </button>
        </div>
      </div>

      {stats && <StatsBar stats={stats} />}

      <div className="filters">
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}>
              {f}
            </button>
          ))}
        </div>
        <input className="form-input search-input" placeholder="Search tasks…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="task-grid-loading">
          {[...Array(6)].map((_, i) => <div key={i} className="task-skeleton" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <RiBarChartLine />
          <h3>No tasks found</h3>
          <p>{filter !== 'all' ? `No ${filter} tasks` : 'Create your first task to get started'}</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
            <RiAddLine /> Create Task
          </button>
        </div>
      ) : (
        <>
          <div className="task-grid">
            {tasks.map(task => (
              <TaskCard key={task._id} task={task}
                onClick={() => navigate(`/tasks/${task._id}`)}
                onDelete={handleDelete} onRetry={handleRetry} />
            ))}
          </div>
          {pagination.pages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span className="page-info">Page {page} of {pagination.pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {showModal && <CreateTaskModal onClose={() => setShowModal(false)} onCreated={handleTaskCreated} />}
    </div>
  );
};

export default DashboardPage;
