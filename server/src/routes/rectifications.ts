import { Router, Response } from 'express';
import db from '../db';
import { AuthRequest, roleGuard } from '../middleware/auth';

const router = Router();

// Get rectification orders
router.get('/', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let orders;

  const baseQuery = `SELECT ro.*,
          ii.item_name, ii.category,
          t.title as task_title, t.area,
          rp.display_name as responsible_person_name,
          rv.display_name as reviewer_name,
          CASE
            WHEN ro.status != 'completed' AND ro.deadline < date('now', 'localtime') THEN 1
            ELSE 0
          END as is_overdue,
          CASE
            WHEN ro.status != 'completed' AND ro.deadline >= date('now', 'localtime') AND ro.deadline <= date('now', '+3 days', 'localtime') THEN 1
            ELSE 0
          END as is_due_soon
   FROM rectification_orders ro
   JOIN inspection_items ii ON ro.inspection_item_id = ii.id
   JOIN tasks t ON ro.task_id = t.id
   JOIN users rp ON ro.responsible_person = rp.id
   LEFT JOIN users rv ON ro.reviewed_by = rv.id`;

  if (user.role === 'inspector') {
    orders = db.prepare(`${baseQuery} WHERE t.assigned_to = ? ORDER BY ro.created_at DESC`).all(user.id);
  } else if (user.role === 'responsible') {
    orders = db.prepare(`${baseQuery} WHERE ro.responsible_person = ? ORDER BY ro.created_at DESC`).all(user.id);
  } else {
    orders = db.prepare(`${baseQuery} ORDER BY ro.created_at DESC`).all();
  }

  res.json(orders);
});

// Get single rectification order
router.get('/:id', (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const order = db.prepare(
    `SELECT ro.*,
            ii.item_name, ii.category, ii.description as item_description, ii.photo_url as item_photo_url,
            t.title as task_title, t.area,
            rp.display_name as responsible_person_name,
            rv.display_name as reviewer_name,
            CASE
              WHEN ro.status != 'completed' AND ro.deadline < date('now', 'localtime') THEN 1
              ELSE 0
            END as is_overdue,
            CASE
              WHEN ro.status != 'completed' AND ro.deadline >= date('now', 'localtime') AND ro.deadline <= date('now', '+3 days', 'localtime') THEN 1
              ELSE 0
            END as is_due_soon
     FROM rectification_orders ro
     JOIN inspection_items ii ON ro.inspection_item_id = ii.id
     JOIN tasks t ON ro.task_id = t.id
     JOIN users rp ON ro.responsible_person = rp.id
     LEFT JOIN users rv ON ro.reviewed_by = rv.id
     WHERE ro.id = ?`
  ).get(orderId);

  if (!order) {
    res.status(404).json({ error: '整改单不存在' });
    return;
  }

  res.json(order);
});

// Create rectification order (inspector creates after finding issues)
router.post('/', roleGuard('inspector'), (req: AuthRequest, res: Response) => {
  const { task_id, inspection_item_id, description, responsible_person, deadline } = req.body;

  if (!task_id || !inspection_item_id || !description || !responsible_person || !deadline) {
    res.status(400).json({ error: '请填写完整信息' });
    return;
  }

  // Get the photo from inspection item
  const item = db.prepare('SELECT photo_url FROM inspection_items WHERE id = ?').get(inspection_item_id) as { photo_url: string | null } | undefined;

  const result = db.prepare(
    `INSERT INTO rectification_orders (task_id, inspection_item_id, description, photo_url, responsible_person, deadline)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(task_id, inspection_item_id, description, item?.photo_url || null, responsible_person, deadline);

  res.json({ id: result.lastInsertRowid, success: true });
});

// Process rectification (responsible person submits fix)
router.put('/:id/process', roleGuard('responsible'), (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const { result_description, result_photo_url } = req.body;

  if (!result_description) {
    res.status(400).json({ error: '请填写整改说明' });
    return;
  }

  db.prepare(
    `UPDATE rectification_orders
     SET status = 'review', result_description = ?, result_photo_url = ?, processed_at = datetime('now', 'localtime')
     WHERE id = ? AND status IN ('pending', 'processing')`
  ).run(result_description, result_photo_url || null, orderId);

  res.json({ success: true });
});

// Start processing (responsible person acknowledges)
router.put('/:id/acknowledge', roleGuard('responsible'), (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  db.prepare(
    "UPDATE rectification_orders SET status = 'processing' WHERE id = ? AND status = 'pending'"
  ).run(orderId);
  res.json({ success: true });
});

// Review rectification (inspector confirms or rejects)
router.put('/:id/review', roleGuard('inspector'), (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const { approved, comment } = req.body;
  const user = req.user!;

  if (approved) {
    db.prepare(
      `UPDATE rectification_orders
       SET status = 'completed', reviewed_at = datetime('now', 'localtime'), reviewed_by = ?
       WHERE id = ? AND status = 'review'`
    ).run(user.id, orderId);
  } else {
    db.prepare(
      `UPDATE rectification_orders
       SET status = 'rejected', result_description = result_description || ' [退回原因: ' || ? || ']',
           reviewed_at = datetime('now', 'localtime'), reviewed_by = ?
       WHERE id = ? AND status = 'review'`
    ).run(comment || '整改不达标', user.id, orderId);
  }

  res.json({ success: true });
});

export default router;
