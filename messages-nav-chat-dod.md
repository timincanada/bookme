# BookMe — Messages 改版 DoD（老板 · 2026-09-22）

现网：TanStack 包 / bookme.training。真扣/商店停。加法。实现默认 **云端 Grok Build（grok-4.7）**；Jules/Opus 仅老板点名。Elena 视觉锁；Riley 部署后冒；Sam 本 DoD；Chris brief/review/部署协调（不手写业务码）。

## 现状（对照）
- Messages 挂在 **More** 下（`/app/more` 链到 `/app/messages`）；底栏/侧栏「More」吃未读角标。
- `/app/messages` 是会话**列表壳**；线程页有轮询气泡，但入口与壳不像即时聊天主入口。
- 对话内**无**「双方下次 booking / swap pending」上下文卡。

## 锁
1. **导航**：Messages 从 More **拆出**，侧栏（md+）与底栏（mobile）各成**单独一项**，放在 **Bookings 正下方**（顺序：… → Bookings → **Messages** → …）。
2. **形态**：做成**即时聊天对话**主体验（非「More → Messages 列表壳」观感）。保留会话列表作收件箱入口可以，但 Messages 入口必须直接进聊天产品面（列表 + 点进线程一体）。
3. **对话上下文**：线程内展示**双方接下来最近一次 booking**（日期/时段/地点或线上标）；若存在 **swap pending**，**优先**展示该 pending，或与下次 booking **一并**展示（不得只显示过期/已取消）。

## 范围
- **教练端** `/app/*`（侧栏 `app.tsx` NAV + `app-tab-bar` + More 去 Messages 行）。
- 学生端 `/manage/messages*`：若已有线程，**同锁**加 booking/swap 上下文卡（导航是否拆项未另拍则保持现入口，只对齐对话内卡）。
- 未读角标：从 More 迁到 **Messages** 项。
- 不改消息权限/mode（send|read|none）、不改 billing、不新开 Stripe。

## DoD
- [ ] 侧栏顺序：Bookings 下一行即 Messages；More 内无 Messages 入口
- [ ] 底栏同序（Bookings 下 Messages）；More 的 match **不再**吞 `/app/messages*`；未读角标在 Messages
- [ ] 点 Messages → 聊天产品面（收件箱可留）；线程为即时对话（发送/轮询/已读不回退）
- [ ] 线程内可见：**下次 booking**（双方视角一致字段）；有 **swap pending** 时优先或并排展示，可点进 Bookings/lesson 处理
- [ ] 无 booking 且无 pending：空态一句，不报错
- [ ] More / Bookings / Clients / Assistant 不回归；真扣/商店仍停

## 视觉（Elena）
短锁：侧栏/底栏 Messages 图标与位置；线程顶或气泡区 **booking 卡** / **swap pending 卡** 样式与优先级。路径建议：`/workspace/bookme/messages-nav-chat-design-lock.md`。

## 实现提示（Grok Build · 非规格）
- NAV/`AppTabBar` 插入 Messages；`more.tsx` 去 Messages Link；未读挂 Messages。
- 线程：复用 `MessageThread`；booking/swap 数据从现有 lesson/request API 取「该 client 最近 upcoming + open coach_swap/move」。
- 加法；勿全仓覆盖。

## 分工
Elena 视觉锁 → Chris brief 云端 Grok Build → 部署 → Riley 冒 → Sam 关。

## 进度
- 2026-09-22：老板要改版；DoD 出。真扣/商店停。
- 2026-09-22：Elena 视觉锁 `/workspace/bookme/messages-nav-chat-design-lock.md`。真扣/商店停。
