# BookMe — Venue / Weather v1 DoD（CEO ask · 2026-09-23）

bookme.training。**加法**。实现默认云端 **Grok Build（grok-4.7）**。真扣/商店停不变（本刀不新开 Stripe 流；天气取消复用现有教练取消退款路径）。Jules/Opus 不点名。

## Intent（锁）
1. 按课绑定的教练 **venue/location**，在相关 booking/session 上向 **教练 + 学生** 展示天气。
2. 预报触达 **极端天气** 阈值时，任一侧可发起「请教练决定：取消还是继续？」
3. 教练确认取消后，通知受影响学生（复用现有取消通知）。

## 已有底座（勿重造）
- `locations`：`name` / `address` / `kind` (`in_person`|`online`) / `place_id` / `lat` / `lng` / `verified`（`migrations/0002_bookme.sql`）。
- 选址：`GOOGLE_MAPS_API_KEY` + Places（`src/lib/bookme/places.ts`）；setup + `/app/more/locations` 可写 lat/lng。
- 课：`lessons.location_id` → join `locations`。
- 取消通知：邮件 `sendMail`（教练取消 → 学生已邮件）；`pushToStudentEmail` / `pushToCoach` 已有，**transport 常未挂** → v1 **邮件必达**，push best-effort。

## 天气源
- **Open-Meteo**（免费、免 key）按 `lat,lng` 取预报。
- 无现付费天气订户 → 不引入付费天气 API。
- 坐标：优先 `locations.lat/lng`；若空且有 `address`/`place_id`，加法补一次 geocode（有 Maps key 用 Places details；否则 Nominatim 单次）并 **写回** `lat/lng`。仍无坐标 → 该 venue **不展示天气、不发极端告警**（空态一句）。

## 适用范围
- 仅 `locations.kind !== 'online'`（在线课跳过）。
- 窗口：课开始前 **72h** 内的 upcoming `confirmed` 课（可配置常量）；过去课不告警。

## 极端阈值（v1 默认 · 服务端常量，可后调）
任一命中即「极端」：
| 信号 | 默认 |
|------|------|
| 降水 | 课时段 ±1h 内 `precipitation_probability` ≥ **70%** 或 `precipitation` ≥ **5 mm/h** |
| 风 | `wind_gusts` ≥ **60 km/h**（或 sustained ≥ 50） |
| 気温 | 体感 / 气温 ≤ **−15°C** 或 ≥ **35°C** |
| 雷电 | Open-Meteo weathercode 雷暴类（95–99）落在课窗 |

文案中性：「预报可能影响户外课」+ 具体信号；不恐吓。

## UX 面
| 面 | 行为 |
|----|------|
| 教练 `/app` 课详情 / Bookings 卡 | 场地旁短预报（图标+高低温/雨概率）；极端时 CTA「取消或继续？」→ 确认取消走现有 `coachCancelLesson` |
| 学生 `/manage` 课卡 | 同预报只读；极端时 CTA「请教练决定」→ 建 **weather_ask**（见下），不直接学生取消退款 |
| 公开 booking link `book.$slug` | v1 **只读**当日/下场次场地预报（无 ask）；勿挡预约主路径 |
| Messages 线程卡 | v1 **可选加法**：有 upcoming 时一行天气；非 blocker |

## 数据 / 流程（加法表）
`weather_asks`（建议）：
- `id`, `lesson_id`, `coach_id`, `opened_by` (`coach`|`student`), `signals` jsonb, `status` (`open`|`keep`|`cancelled`), `created_at`, `resolved_at`
- 同一 `lesson_id` 同时仅一个 `open`
- 教练 **Keep**：关 ask，双方可见「继续」；不发取消信
- 教练 **Cancel**：`status=cancelled` + 调用现有取消（**同教练取消退款**）+ 邮件学生（+ push best-effort）

预报缓存：服务端按 `(lat,lng,hour)` 短缓存（如 30–60 min），避免每页打 Open-Meteo。

## 通知（v1）
- Ask 打开（学生发起）：**邮件教练**（+ push coach best-effort）
- 教练 Keep：可选短邮件/站内；v1 可只站内刷新
- 教练 Cancel：**必发学生取消邮件**（现路径）；push 学生 best-effort
- **不**新开 SMS；**不**要求本刀接通 APNs/FCM

## Out of scope v1
- 自动取消（无教练确认）
- 改定价 / 新 Stripe / 真扣开关
- 付费天气 / Radar 地图全屏
- Indoor override 精细（仅 online 跳过；`in_person` 一律可告警）
- 批量「一天所有课一键取消」可二期
- 商店发版专属 UI

## DoD
- [ ] 有 lat/lng 的 in_person 课：教练+学生 upcoming 可见预报
- [ ] 极端阈值命中可开 weather_ask；教练 Keep / Cancel 正确
- [ ] Cancel → 学生收到取消邮件；退款行为 = 现有教练取消
- [ ] online / 无坐标：无天气、无 ask、不炸
- [ ] 真扣/商店/Messages 主导航不回归

## 分工
Sam 本锁 → Chris brief Grok Build → Elena 短视觉（预报条+ask 确认）→ 部署 → Riley 冒（可 mock Open-Meteo）→ Sam 关。

## 进度
- 2026-09-23：CEO ask；产品锁 brief 出。无 Xiyin blocker（默认阈值+邮件主通道+取消=现教练取消退款）。
