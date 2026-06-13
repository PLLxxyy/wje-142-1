import React, { useEffect, useState, useRef } from 'react';
import {
  User,
  RectificationOrder,
  getRectification,
  acknowledgeRectification,
  processRectification,
  reviewRectification,
  uploadImage,
} from '../api';

interface Props {
  orderId: number;
  user: User;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  review: '待复查',
  completed: '已完成',
  rejected: '已退回',
};

export default function RectificationDetail({ orderId, user, onBack }: Props) {
  const [order, setOrder] = useState<RectificationOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resultDesc, setResultDesc] = useState('');
  const [resultPhoto, setResultPhoto] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [showReject, setShowReject] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await getRectification(orderId);
      setOrder(data);
      setResultDesc(data.result_description || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    setSaving(true);
    try {
      await acknowledgeRectification(orderId);
      setSuccess('已确认接收');
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setSaving(true);
    try {
      const base64 = await fileToBase64(file);
      const url = await uploadImage(base64, file.name);
      setResultPhoto(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async () => {
    if (!resultDesc) {
      setError('请填写整改说明');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await processRectification(orderId, {
        result_description: resultDesc,
        result_photo_url: resultPhoto || undefined,
      });
      setSuccess('整改提交成功，等待巡检员复查');
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (approved: boolean) => {
    setSaving(true);
    setError('');
    try {
      await reviewRectification(orderId, {
        approved,
        comment: approved ? undefined : rejectComment || '整改不达标',
      });
      setSuccess(approved ? '复查通过，整改完成' : '已退回，需重新整改');
      setShowReject(false);
      loadOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>加载中...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#x26a0;&#xfe0f;</div>
        <p>整改单不存在</p>
        <button className="btn btn-outline mt-12" onClick={onBack}>返回</button>
      </div>
    );
  }

  const isOverdue = !!order.is_overdue || (order.status !== 'completed' && new Date(order.deadline) < new Date());
  const isDueSoon = !!order.is_due_soon && !isOverdue;

  return (
    <div>
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>整改管理</a>
        <span style={{ margin: '0 8px' }}>/</span>
        <span>整改单 #{order.id}</span>
      </div>

      <div className="card">
        <div className="flex-between">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>
              整改单 #{order.id} - {order.item_name}
              {isOverdue && (
                <span style={{ marginLeft: 8, fontSize: 12, background: '#e74c3c', color: 'white', padding: '2px 8px', borderRadius: 4 }}>
                  已逾期
                </span>
              )}
              {isDueSoon && (
                <span style={{ marginLeft: 8, fontSize: 12, background: '#f39c12', color: 'white', padding: '2px 8px', borderRadius: 4 }}>
                  即将到期
                </span>
              )}
            </h2>
            <div className="text-sm text-muted" style={{ marginTop: 6 }}>
              {order.category} &middot; {order.area}
            </div>
          </div>
          <span className={`badge badge-${order.status}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Issue info */}
      <div className="card">
        <h3 className="card-title">&#x1f4cb; 隐患信息</h3>
        <div className="detail-row">
          <span className="detail-label">检查项</span>
          <span className="detail-value">{order.item_name} ({order.category})</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">所在区域</span>
          <span className="detail-value">{order.area}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">问题描述</span>
          <span className="detail-value">{order.description}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">责任人</span>
          <span className="detail-value">{order.responsible_person_name}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">整改期限</span>
          <span className="detail-value" style={{ color: isOverdue ? '#e74c3c' : isDueSoon ? '#f39c12' : undefined }}>
            {order.deadline} {isOverdue ? '(已逾期)' : isDueSoon ? '(即将到期)' : ''}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">创建时间</span>
          <span className="detail-value">{order.created_at}</span>
        </div>
        {(order.photo_url || order.item_photo_url) && (
          <div style={{ marginTop: 12 }}>
            <span className="detail-label">隐患照片</span>
            <div style={{ marginTop: 8 }}>
              <img src={order.photo_url || order.item_photo_url || ''} alt="隐患照片" className="photo-preview" />
            </div>
          </div>
        )}
      </div>

      {/* Processing section - for responsible person */}
      {user.role === 'responsible' && (order.status === 'pending' || order.status === 'processing') && (
        <div className="card">
          <h3 className="card-title">&#x1f527; 整改处理</h3>

          {order.status === 'pending' && (
            <div style={{ marginBottom: 16 }}>
              <button className="btn btn-warning" onClick={handleAcknowledge} disabled={saving}>
                确认接收整改任务
              </button>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">整改说明 *</label>
            <textarea
              className="form-textarea"
              placeholder="请描述整改措施和结果..."
              value={resultDesc}
              onChange={(e) => setResultDesc(e.target.value)}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label">整改照片</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
              }}
            />
            {resultPhoto ? (
              <div>
                <img src={resultPhoto} alt="整改照片" className="photo-preview" />
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    重新拍照
                  </button>
                </div>
              </div>
            ) : (
              <div className="photo-upload" onClick={() => fileRef.current?.click()}>
                <div className="photo-upload-text">&#x1f4f7; 点拍上传整改照片</div>
              </div>
            )}
          </div>

          <button
            className="btn btn-success"
            onClick={handleProcess}
            disabled={saving || !resultDesc}
          >
            {saving ? '提交中...' : '提交整改结果'}
          </button>
        </div>
      )}

      {/* Result info - shown after processing */}
      {order.result_description && (
        <div className="card">
          <h3 className="card-title">&#x2705; 整改结果</h3>
          <div className="detail-row">
            <span className="detail-label">整改说明</span>
            <span className="detail-value">{order.result_description}</span>
          </div>
          {order.processed_at && (
            <div className="detail-row">
              <span className="detail-label">处理时间</span>
              <span className="detail-value">{order.processed_at}</span>
            </div>
          )}
          {order.result_photo_url && (
            <div style={{ marginTop: 12 }}>
              <span className="detail-label">整改照片</span>
              <div style={{ marginTop: 8 }}>
                <img src={order.result_photo_url} alt="整改照片" className="photo-preview" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review section - for inspector */}
      {user.role === 'inspector' && order.status === 'review' && (
        <div className="card">
          <h3 className="card-title">&#x1f50d; 复查确认</h3>
          <p style={{ marginBottom: 16, color: '#666', fontSize: 14 }}>
            请确认整改是否符合要求，通过则完成整改流程，退回则需要责任人重新处理。
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-success"
              onClick={() => handleReview(true)}
              disabled={saving}
            >
              &#x2705; 复查通过
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowReject(true)}
              disabled={saving}
            >
              &#x274c; 退回重改
            </button>
          </div>

          {showReject && (
            <div style={{ marginTop: 16, padding: 16, background: '#fdedec', borderRadius: 8 }}>
              <div className="form-group">
                <label className="form-label">退回原因</label>
                <textarea
                  className="form-textarea"
                  placeholder="请说明退回原因..."
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  rows={2}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => handleReview(false)} disabled={saving}>
                  确认退回
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowReject(false)}>取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review result */}
      {order.reviewed_at && (
        <div className="card">
          <h3 className="card-title">&#x1f4dd; 复查结果</h3>
          <div className="detail-row">
            <span className="detail-label">复查状态</span>
            <span className="detail-value">
              <span className={`badge badge-${order.status}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </span>
          </div>
          {order.reviewer_name && (
            <div className="detail-row">
              <span className="detail-label">复查人</span>
              <span className="detail-value">{order.reviewer_name}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">复查时间</span>
            <span className="detail-value">{order.reviewed_at}</span>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <h3 className="card-title">&#x1f4c5; 流程时间线</h3>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <TimelineItem
            title="创建整改单"
            time={order.created_at}
            active
            color="#f39c12"
          />
          {order.processed_at && (
            <TimelineItem
              title="责任人提交整改"
              time={order.processed_at}
              active
              color="#2980b9"
            />
          )}
          {order.reviewed_at && (
            <TimelineItem
              title={order.status === 'completed' ? '复查通过' : '复查退回'}
              time={order.reviewed_at}
              active
              color={order.status === 'completed' ? '#27ae60' : '#e74c3c'}
              last
            />
          )}
          {!order.processed_at && (
            <TimelineItem
              title="等待责任人处理"
              time=""
              active={false}
              color="#ccc"
              last
            />
          )}
          {order.processed_at && !order.reviewed_at && (
            <TimelineItem
              title="等待巡检员复查"
              time=""
              active={false}
              color="#ccc"
              last
            />
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={onBack}>返回列表</button>
      </div>
    </div>
  );
}

function TimelineItem({ title, time, active, color, last }: {
  title: string;
  time: string;
  active: boolean;
  color: string;
  last?: boolean;
}) {
  return (
    <div style={{ position: 'relative', paddingBottom: last ? 0 : 20, paddingLeft: 20 }}>
      <div style={{
        position: 'absolute',
        left: -28,
        top: 4,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color,
        border: active ? 'none' : '2px solid #ddd',
        zIndex: 1,
      }} />
      {!last && (
        <div style={{
          position: 'absolute',
          left: -23,
          top: 18,
          width: 2,
          height: '100%',
          background: active ? color : '#eee',
        }} />
      )}
      <div style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#333' : '#aaa' }}>
        {title}
      </div>
      {time && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
          {time}
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
