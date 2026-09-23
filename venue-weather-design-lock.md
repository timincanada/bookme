# BookMe — Venue / Weather v1 · 短视觉锁（Elena · 2026-09-23）

配套 DoD：`venue-weather-dod.md`。加法。基线：emerald / forest `#10B981`、sans。真扣/商店停。只锁 **预报条/chip** + **weather_ask 取消或继续** 确认；不改导航/定价/Stripe。

## 1. 预报 chip（教练 `/app` · 学生 `/manage` · 公开 booking 只读同构）

贴在 **场地名/地址旁**（课卡或课详情），一行内收完；勿单独大卡挡主路径。

| 项 | 锁 |
|----|-----|
| 形态 | 小 pill / chip：`rounded-full` 或 `rounded-lg`；高约 28–32px；内边距 `px-2.5 py-1` |
| 图标 | Lucide 天气一枚（`CloudSun` / `CloudRain` / `CloudLightning` / `Wind` / `Snowflake` 按主信号）；`size-3.5`–`size-4`；禁 emoji |
| 文案 | 图标 + **高/低 °C**（或单温）+ **雨概率 %**（有则）；例 `22° / 14° · 40%`；英文优先，与现课卡一致 |
| 常态色 | 白/card 底 + `border-line`；字 `text-ink` / muted 次级；**无** forest 填满 |
| 极端色 | 浅琥珀底 `bg-amber-50` + 左边或环 `amber-500`；角标可选小 pill **Weather alert** · amber；文案中性：「预报可能影响户外课」+ 一信号，**不恐吓** |
| 空态 | online / 无坐标：**不渲染 chip**（勿灰块「Weather unavailable」占位） |
| 禁 | 雷达图、全宽 hero、Cadence 紫、大红报警条 |

公开 `book.$slug`：同 chip **只读**，无 CTA。

## 2. 极端 CTA（开 ask 前）

| 面 | CTA 文案 | 样式 |
|----|----------|------|
| 教练 | **Cancel or keep?** | 文字钮或小 outline；`text-forest` / border-forest；贴 chip 右或下一行 |
| 学生 | **Ask coach to decide** | 同构次要钮；**不**直接取消退款 |

点开 → 确认面（§3）。同一课仅一个 open ask 时，CTA 改为态标：**Awaiting coach**（muted pill），禁重复开。

## 3. weather_ask 确认面（教练决定）

轻量 **sheet / dialog**（跟现 BookMe 确认框同构即可）：

```
标题：Weather decision
摘要：场地 · 课次时间 · 信号一句（中性）
[ Keep lesson ]     ← 主：forest 实心 / 描边主钮
[ Cancel lesson ]   ← 次：outline 或 text-destructive 轻；二次确认一句「同教练取消退款」
```

| 项 | 锁 |
|----|-----|
| Keep | 关 ask；双方可见短态 **Keeping lesson**（forest 字或绿勾）；无取消信 |
| Cancel | 走现有 `coachCancelLesson`；确认文案点明退款=现路径；成功后 ask → cancelled |
| 学生侧 | **只读**：见「Waiting on coach」或 Keep/Cancelled 结果；无 Keep/Cancel 钮 |
| 禁 | 自动取消倒计时、一键批量取消、新 Stripe 文案 |

## 4. Messages 线程（可选加法 · 非 blocker）

有 upcoming in_person 时，线程上下文区可多 **一行** 天气（同 chip 缩小版）；极端可链到课详情。勿挤掉 Swap / Next booking 卡优先级。

## 5. 非范围

改价、新 Stripe、真扣开关、商店专属 UI、导航改动、自动取消。

## 落地

路径：`/workspace/bookme/venue-weather-design-lock.md`  
@Chris 并进 Grok Build brief；Riley 冒对照本锁 + DoD。
