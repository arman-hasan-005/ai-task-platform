import { useState } from 'react';
import { tasksAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { RiCloseLine, RiFlashlightLine } from 'react-icons/ri';
import './CreateTaskModal.css';

const OPERATIONS = [
  { value: 'uppercase', label: 'Uppercase', desc: 'Convert all text to UPPERCASE' },
  { value: 'lowercase', label: 'Lowercase', desc: 'Convert all text to lowercase' },
  { value: 'reverse', label: 'Reverse', desc: 'Reverse the entire string' },
  { value: 'word_count', label: 'Word Count', desc: 'Count words, sentences, characters' },
];

const CreateTaskModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ title: '', inputText: '', operation: 'uppercase' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.inputText.trim()) e.inputText = 'Input text is required';
    if (form.inputText.length > 10000) e.inputText = 'Max 10,000 characters';
    if (!form.operation) e.operation = 'Select an operation';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await tasksAPI.create(form);
      onCreated();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create task';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box card fade-in">
        <div className="modal-header">
          <div>
            <h2>Create New Task</h2>
            <p>Configure and queue an AI processing task</p>
          </div>
          <button className="btn-icon" onClick={onClose}><RiCloseLine /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input className={`form-input ${errors.title ? 'input-error' : ''}`}
              placeholder="e.g. Process customer feedback"
              value={form.title} onChange={set('title')} maxLength={100} />
            {errors.title && <span className="form-error">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Operation</label>
            <div className="op-grid">
              {OPERATIONS.map(op => (
                <label key={op.value} className={`op-option ${form.operation === op.value ? 'selected' : ''}`}>
                  <input type="radio" name="operation" value={op.value}
                    checked={form.operation === op.value} onChange={set('operation')} />
                  <span className="op-label">{op.label}</span>
                  <span className="op-desc">{op.desc}</span>
                </label>
              ))}
            </div>
            {errors.operation && <span className="form-error">{errors.operation}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">
              Input Text
              <span className="char-count">{form.inputText.length}/10,000</span>
            </label>
            <textarea
              className={`form-textarea ${errors.inputText ? 'input-error' : ''}`}
              placeholder="Enter the text you want to process…"
              rows={6} maxLength={10000}
              value={form.inputText} onChange={set('inputText')}
            />
            {errors.inputText && <span className="form-error">{errors.inputText}</span>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <RiFlashlightLine />
              {loading ? 'Creating…' : 'Create & Run Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
