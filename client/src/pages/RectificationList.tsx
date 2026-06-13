import React, { useEffect, useState } from 'react';
import { User, RectificationOrder, getRectifications } from '../api';

interface Props {
  user: User;
  onView: (id: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  review: '待复查',
  completed: '已完成',
  rejected: '已退回',
};

export default function RectificationList({ user, onView }: Props) {
  const [orders, setOrders] = useState<RectificationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await getRectifications();
      setOrders(data);
    } catch (err) {
      console.error('加载整改单失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'all') return true;
    return o.status === filter;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const processingCount = orders.filter((o) => o.status === 'processing').length;
  const reviewCount = orders.filter((o) => o.status === 'review').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;

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
      <h2 className="section-title">
        &#x1f4cb; {user.role === 'responsible' ? '我的整改任务' : user.role === 'admin' ? '全部整改单' : '整改管理'}
      </h2>

      <div className="tabs">
        {[
          { key: 'all', label: `全部 (${orders.length})` },
          { key: 'pending', label: `待处理 (${pendingCount})` },
          { key: 'processing', label: `处理中 (${processingCount})` },
          { key: 'review', label: `待复查 (${reviewCount})` },
          { key: 'completed', label: `已完成 (${completedCount})` },
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

      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#x1f4ed;</div>
          <p>暂无整改单</p>
        </div>
      ) : (
        <div className="task-list">
          {filteredOrders.map((order) => {
            const isOverdue = order.status !== 'completed' && new Date(order.deadline) < new Date();

            return (
              <div
                key={order.id}
                className={`task-item ${order.status === 'completed' ? 'completed' : ''}`}
                style={{ borderLeftColor: isOverdue ? '#e74c3c' : order.status === 'completed' ? '#27ae60' : '#f39c12' }}
                onClick={() => onView(order.id)}
              >
                <div className="task-header">
                  <div style={{ flex: 1 }}>
                    <div className="task-title">
                      {order.item_name}
                      {isOverdue && (
                        <span style={{
                          marginLeft: 8,
                          fontSize: 11,
                          background: '#e74c3c',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          已逾期
                        </span>
                      )}
                    </div>
                    <div className="task-meta" style={{ marginTop: 6 }}>
                      <span>&#x1f4cd; {order.area}</span>
                      <span>&#x1f464; 责任人: {order.responsible_person_name}</span>
                      <span>&#x1f4c5; 期限: {order.deadline}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#666', marginTop: 8, lineHeight: 1.5 }}>
                      {order.description}
                    </p>
                  </div>
                  <span className={`badge badge-${order.status}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
