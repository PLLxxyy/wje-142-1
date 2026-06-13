# 消防巡检管理平台

消防巡检管理平台，支持巡检任务管理、逐项检查、隐患上报、整改跟踪和数据统计。涵盖"巡检 → 发现隐患 → 整改单 → 责任人处理 → 巡检员复查"完整流程。

## 技术栈

- **前端**：Vite + React 18 + TypeScript（端口 5173）
- **后端**：Express + TypeScript + better-sqlite3（端口 3000）
- **认证**：JWT + bcryptjs
- **数据库**：SQLite，启动时自动创建
- **启动工具**：concurrently 同时启动前后端

## 快速启动

```bash
# 安装所有依赖（根目录 + client + server）
npm run install:all

# 同时启动前后端
npm run dev
```

启动后访问 http://localhost:5173

## 目录结构

```
wje-142/
├── package.json              # 根目录，concurrently 启动脚本
├── README.md
├── client/                   # 前端
│   ├── index.html            # 全局样式（写在 style 标签内）
│   ├── vite.config.ts        # Vite 配置，proxy /api 到 3000
│   └── src/
│       ├── api.ts            # API 请求封装
│       ├── App.tsx           # 路由 + 角色导航
│       └── pages/
│           ├── Login.tsx     # 登录页
│           ├── TaskList.tsx  # 巡检任务列表
│           ├── InspectTask.tsx       # 逐项检查页面
│           ├── RectificationList.tsx # 整改单列表
│           ├── RectificationDetail.tsx # 整改详情/处理/复查
│           └── AdminDashboard.tsx    # 管理员统计后台
└── server/                   # 后端
    ├── src/
    │   ├── index.ts          # Express 入口，启动时自动 seed
    │   ├── db.ts             # SQLite 建表（4 张表）
    │   ├── seed.ts           # 测试数据（用户 + 任务 + 检查项 + 整改单）
    │   ├── middleware/auth.ts # JWT 鉴权 + 角色守卫
    │   └── routes/
    │       ├── auth.ts       # 登录/用户列表
    │       ├── tasks.ts      # 巡检任务 CRUD
    │       ├── rectifications.ts # 整改单流程
    │       └── admin.ts      # 统计数据
    └── tsconfig.json
```

## 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| inspector    | 123456 | 巡检员 |
| responsible  | 123456 | 整改责任人 |
| admin        | 123456 | 管理员 |

## 功能说明

### 巡检任务（巡检员）
- 查看当日待巡检任务列表，每个任务对应一栋楼或一个区域
- 点进任务逐项检查：灭火器压力、消防通道、应急灯、烟感报警器、消火栓、防火门（共 6 大类 15 项）
- 每项选"正常"或"异常"，异常项可拍照上传并写说明

### 隐患整改流程
1. **巡检员发现隐患** → 提交整改单，指定责任人和整改期限
2. **责任人接单** → 在待办列表看到整改任务，确认受理
3. **责任人处理** → 上传整改照片，填写处理说明，提交完成
4. **巡检员复查** → 审核整改结果，通过则关闭，不通过则退回重做

### 整改详情
- 完整时间线展示：发现 → 接单 → 处理 → 复查，每个节点有时间和说明
- 状态流转：待受理 → 处理中 → 待复查 → 已完成 / 已退回

### 管理员统计后台
- **总览**：巡检完成率、隐患总数、待处理数量
- **区域统计**：各楼栋/区域的完成率柱状图
- **隐患排行**：按区域统计隐患数量排名
- **月度趋势**：近 12 个月的隐患变化折线图
- **巡检员绩效**：各巡检员的任务完成数和发现隐患数

## 注意事项

- 数据库文件保存在 `server/data.db`，首次启动自动创建并 seed 测试数据
- 照片以 base64 格式存储在数据库中，express.json body 限制设为 50mb
- 前端通过 Vite proxy 访问后端，开发环境无需跨域配置
- 如需重置数据，删除 `server/data.db` 后重启服务即可
- 整改单的状态流转有严格顺序，不能跳过步骤
- seed 数据包含过去 30 天的历史巡检记录，方便查看统计图表
