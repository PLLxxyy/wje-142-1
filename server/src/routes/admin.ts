import { Router, Response } from 'express';
import db from '../db';
import { AuthRequest, roleGuard } from '../middleware/auth';

const router = Router();

// All admin routes require admin role
router.use(roleGuard('admin'));

// Dashboard overview stats
router.get('/stats', (_req: AuthRequest, res: Response) => {
  const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  const completedTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get() as { count: number };
  const totalHazards = db.prepare("SELECT COUNT(*) as count FROM rectification_orders").get() as { count: number };
  const pendingHazards = db.prepare("SELECT COUNT(*) as count FROM rectification_orders WHERE status IN ('pending', 'processing')").get() as { count: number };
  const completedHazards = db.prepare("SELECT COUNT(*) as count FROM rectification_orders WHERE status = 'completed'").get() as { count: number };
  const overdueCount = db.prepare(`
    SELECT COUNT(*) as count FROM rectification_orders
    WHERE status != 'completed' AND deadline < date('now', 'localtime')
  `).get() as { count: number };
  const dueSoonCount = db.prepare(`
    SELECT COUNT(*) as count FROM rectification_orders
    WHERE status != 'completed' AND deadline >= date('now', 'localtime') AND deadline <= date('now', '+3 days', 'localtime')
  `).get() as { count: number };

  res.json({
    totalTasks: totalTasks.count,
    completedTasks: completedTasks.count,
    completionRate: totalTasks.count > 0 ? Math.round((completedTasks.count / totalTasks.count) * 100) : 0,
    totalHazards: totalHazards.count,
    pendingHazards: pendingHazards.count,
    completedHazards: completedHazards.count,
    overdueCount: overdueCount.count,
    dueSoonCount: dueSoonCount.count,
  });
});

// Completion rate by building/area
router.get('/area-stats', (_req: AuthRequest, res: Response) => {
  const areaStats = db.prepare(
    `SELECT
       area,
       COUNT(*) as total_tasks,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
       ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as completion_rate
     FROM tasks
     GROUP BY area
     ORDER BY completion_rate ASC`
  ).all();

  res.json(areaStats);
});

// Hazard count ranking by area
router.get('/hazard-ranking', (_req: AuthRequest, res: Response) => {
  const ranking = db.prepare(
    `SELECT
       t.area,
       COUNT(*) as hazard_count,
       SUM(CASE WHEN ro.status = 'completed' THEN 1 ELSE 0 END) as resolved_count,
       SUM(CASE WHEN ro.status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending_count
     FROM rectification_orders ro
     JOIN tasks t ON ro.task_id = t.id
     GROUP BY t.area
     ORDER BY hazard_count DESC`
  ).all();

  res.json(ranking);
});

// Monthly trend data
router.get('/monthly-trends', (_req: AuthRequest, res: Response) => {
  const trends = db.prepare(
    `SELECT
       strftime('%Y-%m', scheduled_date) as month,
       COUNT(*) as total_tasks,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
     FROM tasks
     WHERE scheduled_date >= date('now', '-6 months')
     GROUP BY strftime('%Y-%m', scheduled_date)
     ORDER BY month`
  ).all();

  const hazardTrends = db.prepare(
    `SELECT
       strftime('%Y-%m', ro.created_at) as month,
       COUNT(*) as total_hazards,
       SUM(CASE WHEN ro.status = 'completed' THEN 1 ELSE 0 END) as resolved_hazards
     FROM rectification_orders ro
     WHERE ro.created_at >= date('now', '-6 months')
     GROUP BY strftime('%Y-%m', ro.created_at)
     ORDER BY month`
  ).all();

  res.json({ taskTrends: trends, hazardTrends });
});

// All inspection records
router.get('/all-records', (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const offset = (page - 1) * pageSize;

  const records = db.prepare(
    `SELECT t.*, u.display_name as assigned_to_name,
            (SELECT COUNT(*) FROM inspection_items WHERE task_id = t.id) as total_items,
            (SELECT COUNT(*) FROM inspection_items WHERE task_id = t.id AND status = 'abnormal') as abnormal_items,
            (SELECT COUNT(*) FROM inspection_items WHERE task_id = t.id AND status != 'unchecked') as checked_items
     FROM tasks t
     JOIN users u ON t.assigned_to = u.id
     ORDER BY t.scheduled_date DESC, t.id DESC
     LIMIT ? OFFSET ?`
  ).all(pageSize, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };

  res.json({
    records,
    pagination: {
      page,
      pageSize,
      total: total.count,
      totalPages: Math.ceil(total.count / pageSize),
    },
  });
});

// Inspector performance
router.get('/inspector-stats', (_req: AuthRequest, res: Response) => {
  const stats = db.prepare(
    `SELECT
       u.id, u.display_name,
       COUNT(DISTINCT t.id) as total_tasks,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
       (SELECT COUNT(*) FROM rectification_orders ro
        JOIN tasks t2 ON ro.task_id = t2.id
        WHERE t2.assigned_to = u.id) as hazards_found
     FROM users u
     LEFT JOIN tasks t ON t.assigned_to = u.id
     WHERE u.role = 'inspector'
     GROUP BY u.id`
  ).all();

  res.json(stats);
});

export default router;
