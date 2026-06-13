import db from './db';
import bcrypt from 'bcryptjs';

function seed() {
  console.log('开始插入测试数据...');

  // Clear existing data
  db.exec('DELETE FROM rectification_orders');
  db.exec('DELETE FROM inspection_items');
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM users');

  // Reset auto increment
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'tasks', 'inspection_items', 'rectification_orders')");

  const hashedPassword = bcrypt.hashSync('123456', 10);

  // Insert users
  const insertUser = db.prepare(
    'INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)'
  );

  insertUser.run('inspector', hashedPassword, 'inspector', '张巡检');
  insertUser.run('responsible', hashedPassword, 'responsible', '李整改');
  insertUser.run('admin', hashedPassword, 'admin', '王管理');
  insertUser.run('inspector2', hashedPassword, 'inspector', '赵巡检');
  insertUser.run('responsible2', hashedPassword, 'responsible', '陈整改');

  console.log('用户数据插入完成');

  // Insert tasks
  const insertTask = db.prepare(
    'INSERT INTO tasks (title, area, assigned_to, scheduled_date, status) VALUES (?, ?, ?, ?, ?)'
  );

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  insertTask.run('A栋日常巡检', 'A栋（办公楼）', 1, today, 'pending');
  insertTask.run('B栋日常巡检', 'B栋（宿舍楼）', 1, today, 'pending');
  insertTask.run('C栋日常巡检', 'C栋（仓库）', 1, today, 'pending');
  insertTask.run('D栋日常巡检', 'D栋（食堂）', 4, today, 'pending');
  insertTask.run('A栋昨日巡检', 'A栋（办公楼）', 1, yesterday, 'completed');
  insertTask.run('B栋昨日巡检', 'B栋（宿舍楼）', 1, yesterday, 'completed');

  console.log('任务数据插入完成');

  // Insert inspection items for each task
  const insertItem = db.prepare(
    'INSERT INTO inspection_items (task_id, item_name, category) VALUES (?, ?, ?)'
  );

  const checkItems = [
    { name: '灭火器压力是否正常', category: '灭火器' },
    { name: '灭火器是否在有效期内', category: '灭火器' },
    { name: '灭火器摆放位置是否正确', category: '灭火器' },
    { name: '消防通道是否畅通', category: '消防通道' },
    { name: '消防通道标识是否清晰', category: '消防通道' },
    { name: '安全出口是否畅通', category: '消防通道' },
    { name: '应急灯是否正常亮起', category: '应急照明' },
    { name: '应急灯电池是否充足', category: '应急照明' },
    { name: '疏散指示灯是否正常', category: '应急照明' },
    { name: '烟感报警器是否正常', category: '烟感报警' },
    { name: '手动报警按钮是否正常', category: '烟感报警' },
    { name: '消防栓是否完好', category: '消防栓' },
    { name: '消防栓水压是否正常', category: '消防栓' },
    { name: '防火门是否正常关闭', category: '防火设施' },
    { name: '防火卷帘是否正常', category: '防火设施' },
  ];

  // Create items for all tasks (1-6)
  for (let taskId = 1; taskId <= 6; taskId++) {
    for (const item of checkItems) {
      insertItem.run(taskId, item.name, item.category);
    }
  }

  console.log('巡检项目数据插入完成');

  // Insert some completed inspection data for yesterday's tasks
  const updateItem = db.prepare(
    "UPDATE inspection_items SET status = ?, description = ?, checked_at = datetime('now', 'localtime') WHERE id = ?"
  );
  const getItemIds = (taskId: number) => db.prepare(
    'SELECT id FROM inspection_items WHERE task_id = ? ORDER BY id'
  ).all(taskId).map((row) => (row as { id: number }).id);

  // Task 5 (A栋昨日) - mostly normal, one abnormal
  const task5Items = getItemIds(5);
  for (const itemId of task5Items.slice(0, 14)) {
    updateItem.run('normal', null, itemId);
  }
  const task5AbnormalItem = task5Items[14];
  updateItem.run('abnormal', '灭火器压力不足，指针在红色区域', task5AbnormalItem);

  // Task 6 (B栋昨日) - mostly normal, two abnormal
  const task6Items = getItemIds(6);
  for (const itemId of task6Items.slice(0, 13)) {
    updateItem.run('normal', null, itemId);
  }
  const task6BlockedPassageItem = task6Items[13];
  const task6EmergencyLightItem = task6Items[14];
  updateItem.run('abnormal', '消防通道堆放杂物，影响通行', task6BlockedPassageItem);
  updateItem.run('abnormal', '应急灯不亮，需更换电池', task6EmergencyLightItem);

  // Update task statuses
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('completed', 5);
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('completed', 6);
  db.prepare("UPDATE tasks SET completed_at = datetime('now', 'localtime') WHERE id IN (5, 6)").run();

  // Insert rectification orders for yesterday's abnormalities
  const insertRect = db.prepare(
    `INSERT INTO rectification_orders
     (task_id, inspection_item_id, description, responsible_person, deadline, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  insertRect.run(5, task5AbnormalItem, '灭火器压力不足，请立即更换或重新充装', 2, nextWeek, 'pending');
  insertRect.run(6, task6BlockedPassageItem, '消防通道堆放杂物，请清理', 2, nextWeek, 'pending');
  insertRect.run(6, task6EmergencyLightItem, '应急灯电池耗尽，请更换', 5, nextWeek, 'processing');

  console.log('整改单数据插入完成');

  // Insert some historical data for stats
  const insertHistTask = db.prepare(
    'INSERT INTO tasks (title, area, assigned_to, scheduled_date, status, completed_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  // Historical tasks for monthly stats
  for (let d = 2; d <= 30; d++) {
    const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
    const completedDate = date + ' 17:00:00';
    insertHistTask.run(`A栋巡检-${date}`, 'A栋（办公楼）', 1, date, 'completed', completedDate);
    if (d % 2 === 0) {
      insertHistTask.run(`B栋巡检-${date}`, 'B栋（宿舍楼）', 1, date, 'completed', completedDate);
    }
  }

  console.log('历史数据插入完成');
  console.log('测试数据全部插入完成！');
}

seed();
