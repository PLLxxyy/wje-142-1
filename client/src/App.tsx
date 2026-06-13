import React, { useState, useEffect, useCallback } from 'react';
import { User } from './api';
import Login from './pages/Login';
import TaskList from './pages/TaskList';
import InspectTask from './pages/InspectTask';
import RectificationList from './pages/RectificationList';
import RectificationDetail from './pages/RectificationDetail';
import AdminDashboard from './pages/AdminDashboard';

type Page =
  | { name: 'login' }
  | { name: 'tasks' }
  | { name: 'inspect'; taskId: number }
  | { name: 'rectifications' }
  | { name: 'rectification-detail'; orderId: number }
  | { name: 'admin' };

const ROLE_LABELS: Record<string, string> = {
  inspector: '巡检员',
  responsible: '整改责任人',
  admin: '管理员',
};

const NAV_ITEMS: Record<string, { name: string; page: Page }[]> = {
  inspector: [
    { name: '巡检任务', page: { name: 'tasks' } },
    { name: '整改管理', page: { name: 'rectifications' } },
  ],
  responsible: [
    { name: '整改任务', page: { name: 'rectifications' } },
  ],
  admin: [
    { name: '数据看板', page: { name: 'admin' } },
    { name: '巡检任务', page: { name: 'tasks' } },
    { name: '整改管理', page: { name: 'rectifications' } },
  ],
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>({ name: 'login' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      try {
        const u = JSON.parse(savedUser) as User;
        setUser(u);
        if (u.role === 'admin') {
          setPage({ name: 'admin' });
        } else {
          setPage({ name: 'tasks' });
        }
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = useCallback((u: User) => {
    setUser(u);
    if (u.role === 'admin') {
      setPage({ name: 'admin' });
    } else if (u.role === 'responsible') {
      setPage({ name: 'rectifications' });
    } else {
      setPage({ name: 'tasks' });
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPage({ name: 'login' });
  }, []);

  const navigate = useCallback((p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>加载中...</p>
      </div>
    );
  }

  if (!user || page.name === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  const navItems = NAV_ITEMS[user.role] || [];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>&#x1f6d2; 消防巡检管理平台</h1>
        <div className="header-right">
          <nav style={{ display: 'flex', gap: 4 }}>
            {navItems.map((item) => {
              const isActive =
                (item.page.name === 'tasks' && (page.name === 'tasks' || page.name === 'inspect')) ||
                (item.page.name === 'rectifications' && (page.name === 'rectifications' || page.name === 'rectification-detail')) ||
                (item.page.name === 'admin' && page.name === 'admin');
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.page)}
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'transparent',
                    border: 'none',
                    color: 'white',
                    padding: '6px 14px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {item.name}
                </button>
              );
            })}
          </nav>
          <span className="user-info">
            {user.display_name} ({ROLE_LABELS[user.role]})
          </span>
          <button className="btn-logout" onClick={handleLogout}>退出</button>
        </div>
      </header>

      <main className="main-content">
        {page.name === 'tasks' && (
          <TaskList user={user} onInspect={(taskId) => navigate({ name: 'inspect', taskId })} />
        )}
        {page.name === 'inspect' && (
          <InspectTask
            taskId={page.taskId}
            user={user}
            onBack={() => navigate({ name: 'tasks' })}
          />
        )}
        {page.name === 'rectifications' && (
          <RectificationList
            user={user}
            onView={(id) => navigate({ name: 'rectification-detail', orderId: id })}
          />
        )}
        {page.name === 'rectification-detail' && (
          <RectificationDetail
            orderId={page.orderId}
            user={user}
            onBack={() => navigate({ name: 'rectifications' })}
          />
        )}
        {page.name === 'admin' && (
          <AdminDashboard user={user} />
        )}
      </main>
    </div>
  );
}
