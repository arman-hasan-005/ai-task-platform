import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { RiCpuLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import './AuthPage.css';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.username || form.username.length < 3) e.username = 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = 'Only letters, numbers, underscores';
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) e.password = 'Must contain upper, lower and number';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.username, form.email, form.password);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      toast.error(msg);
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-brand"><RiCpuLine /><span>TaskAI Platform</span></div>
      <div className="auth-card card">
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Start processing AI tasks today</p>
        {errors.general && <div className="alert alert-error">{errors.general}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className={`form-input ${errors.username ? 'input-error' : ''}`} type="text" placeholder="yourname" value={form.username} onChange={set('username')} />
            {errors.username && <span className="form-error">{errors.username}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className={`form-input ${errors.email ? 'input-error' : ''}`} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrap">
              <input className={`form-input ${errors.password ? 'input-error' : ''}`} type={showPass ? 'text' : 'password'} placeholder="Min 8 chars, upper+lower+number" value={form.password} onChange={set('password')} />
              <button type="button" className="input-toggle" onClick={() => setShowPass(p => !p)}>{showPass ? <RiEyeOffLine /> : <RiEyeLine />}</button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className={`form-input ${errors.confirm ? 'input-error' : ''}`} type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} />
            {errors.confirm && <span className="form-error">{errors.confirm}</span>}
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
};

export default RegisterPage;
