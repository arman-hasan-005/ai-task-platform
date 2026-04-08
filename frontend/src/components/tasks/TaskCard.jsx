import { formatDistanceToNow } from 'date-fns';
import { RiDeleteBinLine, RiRefreshLine, RiArrowRightLine } from 'react-icons/ri';
import './TaskCard.css';

const OP_LABELS = {
  uppercase: 'UPPER', lowercase: 'LOWER',
  reverse: 'REVERSE', word_count: 'WORD COUNT',
};

const StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`}>
    <span className="badge-dot" />
    {status}
  </span>
);

const TaskCard = ({ task, onClick, onDelete, onRetry }) => {
  const handleAction = (e, fn) => { e.stopPropagation(); fn(); };

  return (
    <div className="task-card card" onClick={onClick}>
      <div className="task-card-header">
        <StatusBadge status={task.status} />
        <span className="op-tag">{OP_LABELS[task.operation] || task.operation}</span>
      </div>

      <h3 className="task-title">{task.title}</h3>

      <div className="task-meta">
        <span className="task-time">
          {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
        </span>
        {task.processingDurationMs && (
          <span className="task-duration">{task.processingDurationMs}ms</span>
        )}
      </div>

      <div className="task-actions">
        {task.status === 'failed' && (
          <button className="btn btn-success btn-sm" onClick={e => handleAction(e, () => onRetry(task._id))}>
            <RiRefreshLine /> Retry
          </button>
        )}
        <button className="btn btn-danger btn-sm" onClick={e => handleAction(e, () => onDelete(task._id))}>
          <RiDeleteBinLine />
        </button>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
          View <RiArrowRightLine />
        </button>
      </div>
    </div>
  );
};

export default TaskCard;
