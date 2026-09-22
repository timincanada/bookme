# BookMe — Messages 导航 + 线程上下文卡 · 视觉锁（Elena · 2026-09-22）

配套 DoD：`messages-nav-chat-dod.md`。真扣/商店停。加法。基线：emerald / forest `#10B981` 体系、sans；教练 tabs 既有 Calendar / Clipboard / Users / Mic / More。

## 1. 导航位置与顺序

**侧栏（md+）与底栏（mobile）同一顺序：**

`Schedule` → `Bookings` → **`Messages`** → `Clients` → `Assistant` → `More`

- Messages **插在 Bookings 正下方**（DoD）。
- More 内 **去掉** Messages 行；`/app/messages*` **不再** 命中 More 的 active match。
- 未读角标：从 More **迁到 Messages**（数字 pill，与现 More 未读同构：`bg-forest` / `text-on-forest`，>9 显示 `9+`）。
- Bookings 的 pending 小圆点样式不变。

## 2. Messages 图标

| 面 | 锁 |
|----|----|
| Icon | Lucide **`MessageCircle`**（气泡 = 即时聊；禁信封 Mail / 禁 More 点点） |
| 尺寸 | 侧栏 `size-4` stroke 1.75；底栏 `size-5` stroke 1.8（对齐现 NAV） |
| 选中 | `text-forest` + semibold label（现有 active 规则） |
| 未选中 | `text-muted` |

Label：**Messages**（EN）；若有 ZH 面用 **消息**（首版可只 EN，与现 tabs 一致）。

## 3. 聊天产品面（形态，非改码规格）

- 点 Messages → **收件箱列表 + 点进线程**一体（即时聊观感）；勿做成「More 里又一个设置页」。
- 列表行：头像/名 + 末条预览 + 时间；未读行名 semibold + 未读点或计数。
- 线程：顶栏对方名；底输入条；气泡左右分列（己方 forest 浅底或白底描边，对方 muted 卡）——跟现 `MessageThread` 可延用，只要求观感是对话而非表单。

## 4. 线程上下文卡（顶栏下方、首条气泡之上 · sticky 可选）

### 优先级

1. **有 swap pending** → **必须**展示 swap 卡（可点进 Bookings → requests）；**可与**下次 booking 卡**并排/叠放**（swap **在上**）。
2. **仅有下次 booking** → 只展示 booking 卡。
3. **皆无** → 一句空态，无报错：`No upcoming booking with this client.`（ZH 可选：`与该学员暂无即将到来的课。`）

### A. Swap pending 卡（高优先）

| 项 | 锁 |
|----|-----|
| 容器 | 圆角卡 `rounded-xl`；浅琥珀底 `bg-amber-50`（或 token 等价 warning-soft）；左边框 3px `amber-500` |
| 角标 | 小 pill：**Swap pending** · amber 字 |
| 主文 | 双方课次简述（日期/时段各一行或 A ↔ B）；勿只显示过期/已取消 |
| CTA | 文字链或小钮：**Review in Bookings** → `/app/bookings?tab=requests`（可带 swap id）· forest 字 |
| 禁 | 大红错误态；勿与 booking 卡同色导致分不清 |

### B. 下次 booking 卡

| 项 | 锁 |
|----|-----|
| 容器 | 白/card 底；细边 `border-line`；左边框 3px **`forest` / `#10B981`** |
| 角标 | 小 pill：**Next booking** · forest 字 |
| 主文 | 日期 · 时段 · 地点或 **Online**；字段双方视角一致（教练/学生同卡结构） |
| CTA | 可选：**Open lesson** → lesson 详情；次要，muted |
| 禁 | 勿用 Plus/Cadence 紫；勿塞长段落 |

### 叠放

```
[ Swap pending 卡 ]   ← 若有
[ Next booking 卡 ]   ← 若有
──────── 气泡区 ────────
```

两卡间距 8px；总高控制在约 2 卡内，避免挤掉首屏对话。

## 5. 学生端 `/manage/messages*`

对话内卡 **同锁**（样式/优先级同上）。导航是否拆项未另拍 → **保持现入口**，只对齐卡。

## 6. 非范围

- 消息权限 mode、billing、Stripe、真扣/商店。
- Schedule / Bookings / Clients / Assistant / More 其它视觉不动。

## 落地

Chris brief → 云端 Grok Build；Riley 冒；Sam 关 DoD。
