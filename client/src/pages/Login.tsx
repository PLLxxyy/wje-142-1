import React, { useState } from 'react';
import { login, User } from '../api';

interface Props {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const data = await login(username, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-icon">&#x1f6d2;</div>
        <h2 className="login-title">消防巡检管理平台</h2>
        <p className="login-subtitle">安全巡检 · 隐患整改 · 智慧管理</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              type="text"
              className="form-input"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              type="password"
              className="form-input"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: 16, background: '#f8f9fa', borderRadius: 8, fontSize: 13, color: '#666' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>测试账号</div>
          <div>巡检员：inspector / 123456</div>
          <div>整改责任人：responsible / 123456</div>
          <div>管理员：admin / 123456</div>
        </div>
      </div>
    </div>
  );
}
