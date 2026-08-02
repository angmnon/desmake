# DESIGN.md — Desmake

## 产品灵魂
**Swiss editorial × industrial manufacturing（瑞士编辑风 × 工业制造风）**
意象锚点：深夜的车间控制室 —— 暖米色纸张、墨黑色金属、橙色指示灯、等宽打字机字、serif斜体的诗意点缀。

## Design Tokens

### 色彩
- 主背景 `paper`：#f7f6f3（暖米白，像宣纸/再生纸）
- 次背景 `paper-2`：#f1efea
- 卡片白 `surface`：#ffffff
- 主字色 `ink`：#0c0c0d（近黑墨色）
- 强调橙 `signal`：#ff4d18（车间指示灯，CTA/徽章）
- 钴蓝 `cobalt`：#2244ff（链接/处理中状态）
- 苔藓绿 `moss`：#1f7a4d（成功/完成状态）
- 琥珀黄 `amber`：#b57500（生产中/警告）
- 紫罗兰 `violet`：#6b3df5（已发货）

### 字体
- 主字体无衬线：**Inter** (300–800) — UI 正文/标题
- 衬线点缀：**Instrument Serif** (italic 400) — 大标题中"anywhere""geometry"等斜体诗意词
- 等宽字体：**JetBrains Mono** (400,500) — eyebrow/标签/订单号/时间戳/数据
- 字体引入：通过 globals.css 顶部 @import 引入 Google Fonts（CN 环境可使用 fonts.googleapis.cn）

### 圆角
- xs: 4px, sm: 8px, md: 14px, lg: 22px, xl: 32px, full: 999px
- 卡片/按钮：大圆角偏温润，但保留硬朗边缘感

### 阴影
- 多层投影，模拟纸张/物体在台面上的悬浮感
- sh-1：轻（hover 前）；sh-3：重（卡片悬浮）；sh-4：巨型hero卡

### 动效
- 缓动曲线：cubic-bezier(0.22, 1, 0.36, 1) — 快入柔出
- 悬停位移：translateY(-3px / -4px)
- 首屏 hero 卡片缓慢浮动：keyframes fl (9s–13s 错峰)
- 跑马灯：制造 Adapter 条的无限横向滚动

## 布局
- container：最大 1340px（正文）/ 1640px（宽幅首页）/ 860px（窄阅读）
- 内边距：clamp(20px, 4vw, 56px) 响应式
- section 间距：clamp(64px, 8vw, 128px)
- 栅格：首页 4 列 g-4，explore 3–4 列响应式

## 组件规范
- **按钮**：
  - Primary (btn)：ink 底 paper 字、带右箭头
  - Outline (btn-outline)：透明底 ink 边框
  - Paper (btn-paper)：在 ink 深色区块上的反白按钮
  - 大尺寸 (btn-lg)：20px 字号
- **Badge**：圆角 999px，signal/ink 描边
- **Eyebrow**：JetBrains Mono 等宽大写 + 橙色小圆点前缀
- **Segment control**：Trending/New/AI Picks/Editors 切换，is-active 为 ink 底
- **Card**：白底 + 1px 描边 line + 圆角 lg，hover 时上移 + sh-3 阴影
- **Marquee（跑马灯）**：ink 黑底上的等宽字列表，Adapter 名+方法横向滚动
- **Pipeline 四段 (pipe)**：ink 黑底四格，带序号 01–04，展示设计→匹配→打样→发货

## 交互与状态
- 卡片 hover：-translate-y-3~4px + 阴影加深，过渡 0.4s ease
- 订单状态色映射：paid→moss, in_production→amber, quality_check→cobalt, shipped→violet, delivered→moss, exception→signal
- Hero 浮动卡片：三张错落、不同动画周期，叠加玻璃态 Live 进度卡
- 未登录点赞/收藏/关注：弹登录引导（Auth Modal），登录后自动续行为

## 响应式
- 断点 900px：双栏→单栏，pipe 四格→2×2，hero-stage 高度降至 400px
- Mobile 菜单：抽屉式，隐藏二级导航
- 产品网格：g-4 (4列) → g-2 (2列) 于窄屏

## 设计禁忌
- ❌ 禁用科技蓝 + 紫渐变的"AI 套话"配色
- ❌ 禁用过度圆润（>999px圆角胶囊按钮除外）
- ❌ 禁用扁平无阴影设计——必须保留纸感与悬浮感
- ❌ 禁用 emoji 作图标，一律用 Lucide 线性图标
- ❌ 中文界面（本项目全英文）
