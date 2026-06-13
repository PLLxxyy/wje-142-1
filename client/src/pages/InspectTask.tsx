import React, { useEffect, useState, useRef } from 'react';
import { User, Task, InspectionItem, getTask, startTask, saveInspectionItem, completeTask, createRectification, getUsers, uploadImage } from '../api';

interface Props {
  taskId: number;
  user: User;
  onBack: () => void;
}

interface ResponsibleUser {
  id: number;
  display_name: string;
  role: string;
}

export default function InspectTask({ taskId, user, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRectModal, setShowRectModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InspectionItem | null>(null);
  const [responsibleUsers, setResponsibleUsers] = useState<ResponsibleUser[]>([]);
  const [rectForm, setRectForm] = useState({ responsible_person: '', deadline: '', description: '' });
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  useEffect(() => {
    loadTask();
    loadUsers();
  }, [taskId]);

  const loadTask = async () => {
    try {
      const data = await getTask(taskId);
      setTask(data);
      setItems(data.items || []);
      if (data.status === 'pending') {
        await startTask(taskId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const users = await getUsers();
      setResponsibleUsers(users.filter((u: ResponsibleUser) => u.role === 'responsible'));
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (item: InspectionItem, status: 'normal' | 'abnormal') => {
    setSaving(item.id);
    setError('');
    try {
      await saveInspectionItem(item.id, { status });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status, checked_at: new Date().toISOString() } : i))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(null);
    }
  };

  const handlePhotoUpload = async (item: InspectionItem, file: File) => {
    setSaving(item.id);
    setError('');
    try {
      const base64 = await fileToBase64(file);
      const url = await uploadImage(base64, file.name);
      await saveInspectionItem(item.id, {
        status: item.status === 'unchecked' ? 'abnormal' : item.status,
        description: item.description || undefined,
        photo_url: url,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, photo_url: url, status: i.status === 'unchecked' ? 'abnormal' : i.status }
            : i
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setSaving(null);
    }
  };

  const handleDescriptionChange = async (item: InspectionItem, description: string) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, description } : i)));
  };

  const handleSaveDescription = async (item: InspectionItem) => {
    setSaving(item.id);
    try {
      await saveInspectionItem(item.id, {
        status: item.status === 'unchecked' ? 'abnormal' : item.status,
        description: item.description || undefined,
        photo_url: item.photo_url || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(null);
    }
  };

  const handleComplete = async () => {
    const unchecked = items.filter((i) => i.status === 'unchecked');
    if (unchecked.length > 0) {
      setError(`还有 ${unchecked.length} 个项目未检查，请完成所有检查后再提交`);
      return;
    }

    setSaving(-1);
    try {
      await completeTask(taskId);
      setSuccess('巡检任务已完成！');
      setTimeout(() => onBack(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSaving(null);
    }
  };

  const openRectModal = (item: InspectionItem) => {
    setSelectedItem(item);
    setRectForm({
      responsible_person: responsibleUsers[0]?.id?.toString() || '',
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      description: item.description || `巡检发现异常：${item.item_name}`,
    });
    setShowRectModal(true);
  };

  const handleSubmitRect = async () => {
    if (!selectedItem || !rectForm.responsible_person || !rectForm.deadline || !rectForm.description) {
      setError('请填写完整信息');
      return;
    }
    setSaving(-2);
    try {
      await createRectification({
        task_id: taskId,
        inspection_item_id: selectedItem.id,
        description: rectForm.description,
        responsible_person: Number(rectForm.responsible_person),
        deadline: rectForm.deadline,
      });
      setSuccess('整改单已创建');
      setShowRectModal(false);
      setSelectedItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(null);
    }
  };

  const abnormalItems = items.filter((i) => i.status === 'abnormal');
  const uncheckedItems = items.filter((i) => i.status === 'unchecked');
  const progress = items.length > 0 ? Math.round(((items.length - uncheckedItems.length) / items.length) * 100) : 0;

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>加载中...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#x26a0;&#xfe0f;</div>
        <p>任务不存在</p>
        <button className="btn btn-outline mt-12" onClick={onBack}>返回</button>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>巡检任务</a>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>{task.title}</span>
      </div>

      <div className="card">
        <div className="flex-between">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>{task.title}</h2>
            <div className="text-sm text-muted mt-12" style={{ marginTop: 6 }}>
              &#x1f4cd; {task.area} &nbsp; &#x1f4c5; {task.scheduled_date}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: progress === 100 ? '#27ae60' : '#e74c3c' }}>
              {progress}%
            </div>
            <div className="text-sm text-muted">
              已检查 {items.length - uncheckedItems.length}/{items.length}
            </div>
          </div>
        </div>
        <div className="progress-bar" style={{ marginTop: 12 }}>
          <div
            className={`progress-fill ${abnormalItems.length > 0 ? 'red' : progress === 100 ? 'green' : 'yellow'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {user.role === 'inspector' && (
        <>
          <h3 className="section-title mt-20">&#x1f50d; 逐项检查</h3>

          {items.map((item) => (
            <div
              key={item.id}
              className={`inspection-item ${item.status === 'abnormal' ? 'abnormal-item' : ''} ${item.status === 'normal' ? 'normal-item' : ''}`}
            >
              <div className="item-header">
                <div>
                  <span className="item-name">{item.item_name}</span>
                  <span className="item-category" style={{ marginLeft: 8 }}>{item.category}</span>
                </div>
                <span className={`badge badge-${item.status}`}>
                  {item.status === 'unchecked' ? '未检查' : item.status === 'normal' ? '正常' : '异常'}
                </span>
              </div>

              <div className="status-btns">
                <button
                  className={`status-btn ${item.status === 'normal' ? 'normal-active' : ''}`}
                  onClick={() => handleStatusChange(item, 'normal')}
                  disabled={saving === item.id}
                >
                  &#x2705; 正常
                </button>
                <button
                  className={`status-btn ${item.status === 'abnormal' ? 'abnormal-active' : ''}`}
                  onClick={() => handleStatusChange(item, 'abnormal')}
                  disabled={saving === item.id}
                >
                  &#x274c; 异常
                </button>
              </div>

              {item.status === 'abnormal' && (
                <div style={{ marginTop: 12 }}>
                  <div className="form-group">
                    <label className="form-label">异常描述</label>
                    <textarea
                      className="form-textarea"
                      placeholder="请描述异常情况..."
                      value={item.description || ''}
                      onChange={(e) => handleDescriptionChange(item, e.target.value)}
                      onBlur={() => handleSaveDescription(item)}
                      rows={2}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">拍照上传</label>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={(el) => { if (el) fileInputRefs.current.set(item.id, el); }}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(item, file);
                      }}
                    />
                    {item.photo_url ? (
                      <div>
                        <img src={item.photo_url} alt="异常照片" className="photo-preview" />
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => fileInputRefs.current.get(item.id)?.click()}
                          >
                            重新拍照
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="photo-upload"
                        onClick={() => fileInputRefs.current.get(item.id)?.click()}
                      >
                        <div className="photo-upload-text">&#x1f4f7; 点击拍照或上传照片</div>
                      </div>
                    )}
                  </div>

                  {user.role === 'inspector' && task.status !== 'completed' && (
                    <button
                      className="btn btn-warning btn-sm mt-12"
                      onClick={() => openRectModal(item)}
                    >
                      &#x1f4cb; 创建整改单
                    </button>
                  )}
                </div>
              )}

              {saving === item.id && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                  保存中...
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Summary for non-inspector roles */}
      {user.role !== 'inspector' && (
        <div style={{ marginTop: 16 }}>
          <h3 className="section-title">检查结果汇总</h3>
          {items.map((item) => (
            <div key={item.id} className={`inspection-item ${item.status === 'abnormal' ? 'abnormal-item' : ''} ${item.status === 'normal' ? 'normal-item' : ''}`}>
              <div className="item-header">
                <span className="item-name">{item.item_name}</span>
                <span className={`badge badge-${item.status}`}>
                  {item.status === 'unchecked' ? '未检查' : item.status === 'normal' ? '正常' : '异常'}
                </span>
              </div>
              {item.status === 'abnormal' && item.description && (
                <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>{item.description}</p>
              )}
              {item.photo_url && (
                <img src={item.photo_url} alt="照片" className="photo-preview" style={{ marginTop: 8 }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Complete button */}
      {user.role === 'inspector' && task.status !== 'completed' && (
        <div className="action-bar">
          <div className="text-sm text-muted">
            {abnormalItems.length > 0 && (
              <span style={{ color: '#e74c3c' }}>&#x26a0;&#xfe0f; 发现 {abnormalItems.length} 处隐患</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onBack}>暂存返回</button>
            <button
              className="btn btn-primary"
              onClick={handleComplete}
              disabled={saving === -1 || uncheckedItems.length > 0}
            >
              {saving === -1 ? '提交中...' : '完成巡检'}
            </button>
          </div>
        </div>
      )}

      {/* Rectification modal */}
      {showRectModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowRectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">&#x1f4cb; 创建整改单</h3>
            <div className="alert alert-info">
              整改项：{selectedItem.item_name} ({selectedItem.category})
            </div>

            <div className="form-group">
              <label className="form-label">问题描述</label>
              <textarea
                className="form-textarea"
                value={rectForm.description}
                onChange={(e) => setRectForm({ ...rectForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="form-label">整改责任人</label>
              <select
                className="form-select"
                value={rectForm.responsible_person}
                onChange={(e) => setRectForm({ ...rectForm, responsible_person: e.target.value })}
              >
                <option value="">请选择责任人</option>
                {responsibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">整改期限</label>
              <input
                type="date"
                className="form-input"
                value={rectForm.deadline}
                onChange={(e) => setRectForm({ ...rectForm, deadline: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRectModal(false)}>取消</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitRect}
                disabled={saving === -2}
              >
                {saving === -2 ? '创建中...' : '创建整改单'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
