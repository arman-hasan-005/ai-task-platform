import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tasksAPI } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  RiArrowLeftLine, RiRefreshLine, RiDeleteBinLine,
  RiTimeLine, RiCheckLine, RiCloseLine, RiLoader4Line,
  RiFileCopyLine,
} from 'react-icons/ri';
import './TaskDetailPage.css';

const POLL_MS = 3000;

const StatusIcon = ({ status }) => {
  const icons = {
    pending: <RiTimeLine />, running: <RiLoader4Line className="spin" />,
    success: <RiCheckLine />, failed: <RiCloseLine />,
  };
  return icons[status] || null;
};

const LogLevel = ({ level }) => {
  const cls = { info: 'log-info', warn: 'log-warn', error: 'log-error' };
  return <span className={`log-level ${cls[level] || ''}`}>{level}</span>;
};

const TaskDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTask = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await tasksAPI.getOne(id);
      setTask(data.data.task);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Task not found');
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  useEffect(() => {
    if (!task) return;
    if (task.status !== 'pending' && task.status !== 'running') return;
    const id = setInterval(() => fetchTask(true), POLL_MS);
    return () => clearInterval(id);
  }, [task, fetchTask]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await tasksAPI.retry(id);
      toast.success('Task queued for retry');
      fetchTask();
    } catch { toast.error('Retry failed'); }
    finally { setRetrying(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task?')) return;
    setDeleting(true);
    try {
      await tasksAPI.delete(id);
      toast.success('Task deleted');
      navigate('/dashboard');
    } catch { toast.error('Delete failed'); setDeleting(false); }
  };

  const copyResult = () => {
    const out = task?.result?.output || JSON.stringify(task?.result, null, 2);
    navigator.clipboard.writeText(out);
    toast.success('Copied!');
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
      <div className="spinner" />
    </div>
  );
  if (!task) return null;

  const resultOutput = task.result?.output !== undefined
    ? task.result.output
    : task.result ? JSON.stringify(task.result, null, 2) : null;

  const resultMeta = task.result ? Object.entries(task.result).filter(([k]) => k !== 'output' && k !== 'operation') : [];

  return (
    <div className="task-detail fade-in">
      <div className="detail-topbar">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')}>
          <RiArrowLeftLine /> Back
        </button>
        <div className="detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => fetchTask()}>
            <RiRefreshLine /> Refresh
          </button>
          {task.status === 'failed' && (
            <button className="btn btn-success btn-sm" onClick={handleRetry} disabled={retrying}>
              <RiRefreshLine /> {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
            <RiDeleteBinLine /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left Column */}
        <div className="detail-left">
          <div className="card detail-card">
            <div className="detail-status-row">
              <span className={`badge badge-${task.status}`}>
                <StatusIcon status={task.status} />
                {task.status}
              </span>
              <span className="op-tag mono">{task.operation}</span>
            </div>
            <h1 className="detail-title">{task.title}</h1>

            <div className="detail-meta-grid">
              <div className="meta-item">
                <span className="meta-label">Created</span>
                <span className="meta-value">{format(new Date(task.createdAt), 'PPpp')}</span>
              </div>
              {task.startedAt && (
                <div className="meta-item">
                  <span className="meta-label">Started</span>
                  <span className="meta-value">{format(new Date(task.startedAt), 'PPpp')}</span>
                </div>
              )}
              {task.completedAt && (
                <div className="meta-item">
                  <span className="meta-label">Completed</span>
                  <span className="meta-value">{format(new Date(task.completedAt), 'PPpp')}</span>
                </div>
              )}
              {task.processingDurationMs && (
                <div className="meta-item">
                  <span className="meta-label">Duration</span>
                  <span className="meta-value mono">{task.processingDurationMs}ms</span>
                </div>
              )}
              {task.workerId && (
                <div className="meta-item">
                  <span className="meta-label">Worker</span>
                  <span className="meta-value mono">{task.workerId}</span>
                </div>
              )}
              {task.retryCount > 0 && (
                <div className="meta-item">
                  <span className="meta-label">Retries</span>
                  <span className="meta-value">{task.retryCount}</span>
                </div>
              )}
            </div>

            {task.errorMessage && (
              <div className="error-box">
                <span className="error-label">Error</span>
                <p>{task.errorMessage}</p>
              </div>
            )}
          </div>

          <div className="card detail-card">
            <h3 className="section-title">Input Text</h3>
            <pre>{task.inputText}</pre>
          </div>

          {task.result && (
            <div className="card detail-card">
              <div className="section-header">
                <h3 className="section-title">Result</h3>
                <button className="btn btn-secondary btn-sm" onClick={copyResult}>
                  <RiFileCopyLine /> Copy
                </button>
              </div>
              {resultOutput !== null && <pre className="result-output">{String(resultOutput)}</pre>}
              {resultMeta.length > 0 && (
                <div className="result-meta">
                  {resultMeta.map(([k, v]) => (
                    <div key={k} className="result-meta-item">
                      <span className="meta-label">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="meta-value mono">
                        {Array.isArray(v) ? v.map(x => `${x.word}(${x.count})`).join(', ') : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Logs */}
        <div className="detail-right">
          <div className="card detail-card logs-card">
            <h3 className="section-title">Task Logs</h3>
            <div className="logs-container">
              {task.logs?.length === 0 ? (
                <p className="no-logs">No logs yet</p>
              ) : (
                task.logs.map((log, i) => (
                  <div key={i} className={`log-entry log-entry-${log.level}`}>
                    <div className="log-header">
                      <LogLevel level={log.level} />
                      <span className="log-time mono">
                        {format(new Date(log.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="log-msg">{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;
