# BookMe.training · #8 / #9 / #11 入口文案锁（Elena · 2026-09-24）

配套 DoD：`training-issues-2026-09-24-dod.md`。只锁入口位置与文案；#4/#12 及 P1 其余工程修。真扣/商店停。加法。基线：forest `#10B981`、sans、More 列表同构。

## #8 课程统一管理入口

| 项 | 锁 |
|----|-----|
| 位置 | **More** 列表：放在 **Locations** 正下方、**Payments** 之上 |
| Label | **Lessons**（禁 Offerings / Products / Services） |
| 路由 | `/app/more/lessons`（或现有等价；新建页） |
| 页标题 | **Lessons** |
| 副文 | 一句 muted：`Duration and price for each lesson length.` |
| 列表行 | 课名（或默认 Lesson）· 各时长一行 `30 min · $X` / `60 min · $Y`；点进编辑 |
| 空态 | `No lessons yet.` + 主钮 **Set up lessons** → 现 setup / open-for-business 配课时长价的路径 |
| 禁 | 不进底栏新 tab；不改 Schedule/Bookings/Messages/Clients/Assistant 顺序 |

## #9 右上角头像 Account 菜单

| 项 | 锁 |
|----|-----|
| 触发 | 教练 app 顶栏 **头像**（有则图，无则字母）点击 |
| 菜单三项（顺序固定） | **Account** → `/app/more/account` · **Subscription** → `/app/billing`（文案用 Subscription，勿写 Plan） · **Sign out**（末项；destructive 轻：红字或分隔线下方） |
| 形态 | 下拉/popover，白底 `ring-line`；点外关闭 |
| 禁 | 勿塞 Settings 杂项；More 里原有 Account / Plan 行可保留（双入口 OK） |

## #11 学生专属 Booking 链接（文案 / 入口）

根因：教练易把 **Student desk /manage** 当预约主链发出去。锁复制与分区文案，工程保证主链 = 教练 Booking Page。

| 面 | 锁 |
|----|-----|
| 主分享块标题 | **Your booking link**（setup 完成页已有则统一；More 现「Booking page」→ 改成同文案 **Your booking link**） |
| 主链 | `bookme.training/{slug}` 或现有 `BookingShare` 公开预约 URL；按钮 **Copy link** / **Share** |
| 主链说明 | muted 一句：`Students use this to book a new lesson.` |
| 次块标题 | **Student desk**（保留） |
| 次链 | `/manage` 类 manage URL |
| 次块说明 | 改成：`For students who already booked — move a lesson or message you. Not for new bookings.` |
| 次块按钮 | **Copy desk link**（勿再写 Copy manage link，避免当主预约链） |
| 禁 | 邮件/推送「去预约」CTA 不得指向 `/manage`；预约确认信里「管理已约」可继续链 desk |

## 非范围

Places 搜索、OTP 邮件、金额框、Timezone、Booking window、Subscription Status/套餐可点、藏 demo student、Venue/Weather。

## 落地

`/workspace/bookme/issue-packs/training-issues-8-9-11-ux-lock.md`  
@Chris 并进 #8+#11 PR brief；#9 可随 P1 soft。Riley 冒对照本锁。
