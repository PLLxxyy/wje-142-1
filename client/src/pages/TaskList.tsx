import React, { useEffect, useState } from 'react';
import { User, Task, getTasks } from '../api';

interface Props {
  user: User;
  onInspect: (taskId: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待巡检',
  in_progress: '巡检中',
  completed: '已完成',
};

export default function TaskList({ user, onInspect }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error('加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter((t) => t.scheduled_date === today);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>加载中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          &#x1f4cb; {user.role === 'admin' ? '全部巡检任务' : '我的巡检任务'}
        </h2>
        <div className="text-sm text-muted">
          今日任务: {todayTasks.length} 项
        </div>
      </div>

      <div className="tabs">
        {[
          { key: 'all', label: `全部 (${tasks.length})` },
          { key: 'pending', label: `待巡检 (${tasks.filter((t) => t.status === 'pending').length})` },
          { key: 'in_progress', label: `巡检中 (${tasks.filter((t) => t.status === 'in_progress').length})` },
          { key: 'completed', label: `已完成 (${tasks.filter((t) => t.status === 'completed').length})` },
        ].map((tab) => (
          <div
            key={tab.key}
            className={`tab ${filter === tab.key ? 'active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#x1f4ed;</div>
          <p>暂无任务</p>
        </div>
      ) : (
        <div className="task-list">
          {filteredTasks.map((task) => {
            const summary = task.summary;
            const total = summary?.total || 0;
            const checked = summary?.checked_count || 0;
            const abnormal = summary?.abnormal_count || 0;
            const progress = total > 0 ? Math.round((checked / total) * 100) : 0;
            const isToday = task.scheduled_date === today;

            return (
              <div
                key={task.id}
                className={`task-item ${task.status}`}
                onClick={() => onInspect(task.id)}
              >
                <div className="task-header">
                  <div>
                    <div className="task-title">
                      {task.title}
                      {isToday && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 11,
                          background: '#e74c3c',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          今日
                        </span>
                      )}
                    </div>
                    <div className="task-meta" style={{ marginTop: 6 }}>
                      <span>&#x1f4cd; {task.area}</span>
                      <span>&#x1f4c5; {task.scheduled_date}</span>
                      {user.role === 'admin' && <span>&#x1f464; {task.assigned_to_name}</span>}
                    </div>
                  </div>
                  <span className={`badge badge-${task.status}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>

                {task.status !== 'pending' && (
                  <div className="task-progress">
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${abnormal > 0 ? 'red' : progress === 100 ? 'green' : 'yellow'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="progress-text">
                      已检查 {checked}/{total}
                      {abnormal > 0 && <span style={{ color: '#e74c3c', marginLeft: 8 }}>异常 {abnormal} 项</span>}
                      {progress === 100 && abnormal === 0 && <span style={{ color: '#27ae60', marginLeft: 8 }}>全部正常</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
