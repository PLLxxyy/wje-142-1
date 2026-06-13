import { Router, Response } from 'express';
import db from '../db';
import { AuthRequest, roleGuard } from '../middleware/auth';

const router = Router();

interface TaskRow {
  id: number;
  title: string;
  area: string;
  assigned_to: number;
  assigned_to_name: string;
  scheduled_date: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

// Get tasks for current user (inspector sees their tasks)
router.get('/', (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let tasks: TaskRow[];

  if (user.role === 'inspector') {
    tasks = db.prepare(
      `SELECT t.*, u.display_name as assigned_to_name
       FROM tasks t
       JOIN users u ON t.assigned_to = u.id
       WHERE t.assigned_to = ?
       ORDER BY t.scheduled_date DESC, t.id DESC`
    ).all(user.id) as TaskRow[];
  } else if (user.role === 'admin') {
    tasks = db.prepare(
      `SELECT t.*, u.display_name as assigned_to_name
       FROM tasks t
       JOIN users u ON t.assigned_to = u.id
       ORDER BY t.scheduled_date DESC, t.id DESC`
    ).all() as TaskRow[];
  } else {
    res.status(403).json({ error: '无权查看任务列表' });
    return;
  }

  // Attach summary to each task
  const summaryStmt = db.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal_count,
       SUM(CASE WHEN status = 'abnormal' THEN 1 ELSE 0 END) as abnormal_count,
       SUM(CASE WHEN status != 'unchecked' THEN 1 ELSE 0 END) as checked_count
     FROM inspection_items WHERE task_id = ?`
  );

  const result = tasks.map((task) => {
    const summary = summaryStmt.get(task.id) as Record<string, number>;
    return { ...task, summary };
  });

  res.json(result);
});

// Get single task with inspection items
router.get('/:id', (req: AuthRequest, res: Response) => {
  const taskId = Number(req.params.id);
  const task = db.prepare(
    `SELECT t.*, u.display_name as assigned_to_name
     FROM tasks t
     JOIN users u ON t.assigned_to = u.id
     WHERE t.id = ?`
  ).get(taskId) as Record<string, unknown> | undefined;

  if (!task) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }

  const items = db.prepare(
    'SELECT * FROM inspection_items WHERE task_id = ? ORDER BY id'
  ).all(taskId);

  res.json({ ...task, items });
});

// Update task status to in_progress
router.put('/:id/start', (req: AuthRequest, res: Response) => {
  const taskId = Number(req.params.id);
  db.prepare("UPDATE tasks SET status = 'in_progress' WHERE id = ? AND status = 'pending'").run(taskId);
  res.json({ success: true });
});

// Save inspection item result
router.put('/items/:itemId', (req: AuthRequest, res: Response) => {
  const itemId = Number(req.params.itemId);
  const { status, description, photo_url } = req.body;

  if (!['normal', 'abnormal'].includes(status)) {
    res.status(400).json({ error: '状态必须是 normal 或 abnormal' });
    return;
  }

  db.prepare(
    `UPDATE inspection_items
     SET status = ?, description = ?, photo_url = ?, checked_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(status, description || null, photo_url || null, itemId);

  res.json({ success: true });
});

// Submit task (complete inspection)
router.put('/:id/complete', (req: AuthRequest, res: Response) => {
  const taskId = Number(req.params.id);

  // Check if all items are checked
  const unchecked = db.prepare(
    "SELECT COUNT(*) as count FROM inspection_items WHERE task_id = ? AND status = 'unchecked'"
  ).get(taskId) as { count: number };

  if (unchecked.count > 0) {
    res.status(400).json({ error: `还有 ${unchecked.count} 个项目未检查，请完成所有检查后再提交` });
    return;
  }

  db.prepare(
    "UPDATE tasks SET status = 'completed', completed_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(taskId);

  res.json({ success: true });
});

export default router;
