import React, { useEffect, useState } from 'react';
import {
  User,
  Task,
  InspectionRecord,
  getAdminStats,
  getAreaStats,
  getHazardRanking,
  getMonthlyTrends,
  getAllRecords,
  getInspectorStats,
} from '../api';

interface Props {
  user: User;
}

interface Stats {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalHazards: number;
  pendingHazards: number;
  completedHazards: number;
  overdueCount: number;
  dueSoonCount: number;
}

interface AreaStat {
  area: string;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
}

interface HazardRank {
  area: string;
  hazard_count: number;
  resolved_count: number;
  pending_count: number;
}

interface MonthlyTrend {
  taskTrends: { month: string; total_tasks: number; completed_tasks: number }[];
  hazardTrends: { month: string; total_hazards: number; resolved_hazards: number }[];
}

interface InspectorStat {
  id: number;
  display_name: string;
  total_tasks: number;
  completed_tasks: number;
  hazards_found: number;
}

export default function AdminDashboard({ user }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [areaStats, setAreaStats] = useState<AreaStat[]>([]);
  const [hazardRanking, setHazardRanking] = useState<HazardRank[]>([]);
  const [trends, setTrends] = useState<MonthlyTrend | null>(null);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 });
  const [inspectorStats, setInspectorStats] = useState<InspectorStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [s, a, h, t, r, i] = await Promise.all([
        getAdminStats(),
        getAreaStats(),
        getHazardRanking(),
        getMonthlyTrends(),
        getAllRecords(1, 10),
        getInspectorStats(),
      ]);
      setStats(s as Stats);
      setAreaStats(a as AreaStat[]);
      setHazardRanking(h as HazardRank[]);
      setTrends(t as MonthlyTrend);
      setRecords((r as { records: InspectionRecord[]; pagination: typeof pagination }).records);
      setPagination((r as { records: InspectionRecord[]; pagination: typeof pagination }).pagination);
      setInspectorStats(i as InspectorStat[]);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (page: number) => {
    try {
      const r = await getAllRecords(page, 10) as { records: InspectionRecord[]; pagination: typeof pagination };
      setRecords(r.records);
      setPagination(r.pagination);
    } catch (err) {
      console.error('加载记录失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>加载数据看板...</p>
      </div>
    );
  }

  const maxHazard = Math.max(...hazardRanking.map((r) => r.hazard_count), 1);

  return (
    <div>
      <h2 className="section-title">&#x1f4ca; 管理员数据看板</h2>

      <div className="tabs">
        {[
          { key: 'overview', label: '总览' },
          { key: 'areas', label: '区域分析' },
          { key: 'inspectors', label: '巡检员绩效' },
          { key: 'records', label: '巡检记录' },
        ].map((tab) => (
          <div
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {activeTab === 'overview' && stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalTasks}</div>
              <div className="stat-label">总巡检任务</div>
            </div>
            <div className="stat-card green">
              <div className="stat-value">{stats.completedTasks}</div>
              <div className="stat-label">已完成任务</div>
            </div>
            <div className="stat-card yellow">
              <div className="stat-value">{stats.completionRate}%</div>
              <div className="stat-label">完成率</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-value">{stats.totalHazards}</div>
              <div className="stat-label">发现隐患</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#f39c12' }}>{stats.pendingHazards}</div>
              <div className="stat-label">待处理隐患</div>
            </div>
            <div className="stat-card green">
              <div className="stat-value">{stats.completedHazards}</div>
              <div className="stat-label">已整改隐患</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #e74c3c' }}>
              <div className="stat-value" style={{ color: '#e74c3c' }}>{stats.overdueCount}</div>
              <div className="stat-label">已超期</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid #f39c12' }}>
              <div className="stat-value" style={{ color: '#f39c12' }}>{stats.dueSoonCount}</div>
              <div className="stat-label">即将到期（3天内）</div>
            </div>
          </div>

          <div className="stats-row">
            {/* Monthly trends - task completion */}
            {trends && (
              <>
                <div className="card">
                  <h3 className="card-title">&#x1f4c8; 月度巡检完成趋势</h3>
                  <div className="bar-chart">
                    {trends.taskTrends.length === 0 ? (
                      <div className="text-sm text-muted">暂无数据</div>
                    ) : (
                      trends.taskTrends.map((t) => {
                        const rate = t.total_tasks > 0 ? Math.round((t.completed_tasks / t.total_tasks) * 100) : 0;
                        return (
                          <div className="bar-row" key={t.month}>
                            <span className="bar-label">{t.month}</span>
                            <div className="bar-track">
                              <div className="bar-fill green" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="bar-value">{rate}%</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title">&#x26a0;&#xfe0f; 月度隐患趋势</h3>
                  <div className="bar-chart">
                    {trends.hazardTrends.length === 0 ? (
                      <div className="text-sm text-muted">暂无数据</div>
                    ) : (
                      trends.hazardTrends.map((t) => {
                        const maxVal = Math.max(...trends.hazardTrends.map((h) => h.total_hazards), 1);
                        return (
                          <div className="bar-row" key={t.month}>
                            <span className="bar-label">{t.month}</span>
                            <div className="bar-track">
                              <div className="bar-fill red" style={{ width: `${(t.total_hazards / maxVal) * 100}%` }} />
                            </div>
                            <span className="bar-value">{t.total_hazards} / {t.resolved_hazards}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'areas' && (
        <>
          <div className="stats-row">
            {/* Area completion rate */}
            <div className="card">
              <h3 className="card-title">&#x1f3d7;&#xfe0f; 各区域巡检完成率</h3>
              <div className="bar-chart">
                {areaStats.length === 0 ? (
                  <div className="text-sm text-muted">暂无数据</div>
                ) : (
                  areaStats.map((a) => (
                    <div className="bar-row" key={a.area}>
                      <span className="bar-label">{a.area}</span>
                      <div className="bar-track">
                        <div
                          className={`bar-fill ${a.completion_rate >= 80 ? 'green' : a.completion_rate >= 50 ? 'yellow' : 'red'}`}
                          style={{ width: `${a.completion_rate}%` }}
                        />
                      </div>
                      <span className="bar-value">{a.completion_rate}%</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Hazard ranking */}
            <div className="card">
              <h3 className="card-title">&#x1f525; 隐患数量排行</h3>
              <div className="bar-chart">
                {hazardRanking.length === 0 ? (
                  <div className="text-sm text-muted">暂无数据</div>
                ) : (
                  hazardRanking.map((h) => (
                    <div className="bar-row" key={h.area}>
                      <span className="bar-label">{h.area}</span>
                      <div className="bar-track">
                        <div className="bar-fill red" style={{ width: `${(h.hazard_count / maxHazard) * 100}%` }} />
                      </div>
                      <span className="bar-value">{h.hazard_count} 处</span>
                    </div>
                  ))
                )}
              </div>
              {hazardRanking.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: '#f8f9fa', borderRadius: 6, fontSize: 13, color: '#666' }}>
                  隐患最多区域: <strong style={{ color: '#e74c3c' }}>{hazardRanking[0]?.area}</strong>
                  （{hazardRanking[0]?.hazard_count} 处，已整改 {hazardRanking[0]?.resolved_count} 处）
                </div>
              )}
            </div>
          </div>

          {/* Area detail table */}
          <div className="card">
            <h3 className="card-title">&#x1f4cb; 区域详情</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>区域</th>
                  <th>任务总数</th>
                  <th>已完成</th>
                  <th>完成率</th>
                  <th>隐患数</th>
                  <th>待处理</th>
                </tr>
              </thead>
              <tbody>
                {areaStats.map((a) => {
                  const hazard = hazardRanking.find((h) => h.area === a.area);
                  return (
                    <tr key={a.area}>
                      <td>{a.area}</td>
                      <td>{a.total_tasks}</td>
                      <td>{a.completed_tasks}</td>
                      <td>
                        <span style={{
                          color: a.completion_rate >= 80 ? '#27ae60' : a.completion_rate >= 50 ? '#f39c12' : '#e74c3c',
                          fontWeight: 600,
                        }}>
                          {a.completion_rate}%
                        </span>
                      </td>
                      <td>{hazard?.hazard_count || 0}</td>
                      <td>
                        <span style={{ color: (hazard?.pending_count || 0) > 0 ? '#e74c3c' : '#27ae60' }}>
                          {hazard?.pending_count || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'inspectors' && (
        <div className="card">
          <h3 className="card-title">&#x1f465; 巡检员绩效统计</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>总任务数</th>
                <th>已完成</th>
                <th>完成率</th>
                <th>发现隐患</th>
              </tr>
            </thead>
            <tbody>
              {inspectorStats.map((inspector) => {
                const rate = inspector.total_tasks > 0
                  ? Math.round((inspector.completed_tasks / inspector.total_tasks) * 100)
                  : 0;
                return (
                  <tr key={inspector.id}>
                    <td style={{ fontWeight: 500 }}>{inspector.display_name}</td>
                    <td>{inspector.total_tasks}</td>
                    <td>{inspector.completed_tasks}</td>
                    <td>
                      <span style={{
                        color: rate >= 80 ? '#27ae60' : rate >= 50 ? '#f39c12' : '#e74c3c',
                        fontWeight: 600,
                      }}>
                        {rate}%
                      </span>
                    </td>
                    <td>{inspector.hazards_found}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'records' && (
        <div className="card">
          <h3 className="card-title">&#x1f4d1; 全部巡检记录</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>任务名称</th>
                <th>区域</th>
                <th>巡检员</th>
                <th>日期</th>
                <th>状态</th>
                <th>检查项</th>
                <th>异常项</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.id}</td>
                  <td>{record.title}</td>
                  <td>{record.area}</td>
                  <td>{record.assigned_to_name}</td>
                  <td>{record.scheduled_date}</td>
                  <td>
                    <span className={`badge badge-${record.status}`}>
                      {record.status === 'pending' ? '待巡检' : record.status === 'in_progress' ? '巡检中' : '已完成'}
                    </span>
                  </td>
                  <td>{record.total_items || 0}</td>
                  <td>
                    <span style={{
                      color: (record.abnormal_items || 0) > 0 ? '#e74c3c' : '#27ae60',
                      fontWeight: 600,
                    }}>
                      {record.abnormal_items || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => loadPage(pagination.page - 1)}
              >
                上一页
              </button>
              <span style={{ lineHeight: '32px', fontSize: 14, color: '#888' }}>
                第 {pagination.page} / {pagination.totalPages} 页
              </span>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadPage(pagination.page + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
