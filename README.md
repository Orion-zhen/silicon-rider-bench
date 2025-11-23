# Silicon Rider Bench（硅基骑手）

世界上首个多模态 Agent 基准测试项目，旨在评估单模态/多模态模型作为智能体的能力。

## 项目简介

Silicon Rider Bench 模拟外卖骑手的工作流程，AI 智能体通过调用工具做出决策，最终评价基于固定时间内赚取的利润。该基准测试提供了一个虚拟沙箱环境，智能体在模拟城市中导航、接单、取餐、送餐，并管理电池电量等资源。

### 核心特性

- 🎯 **真实场景模拟**：模拟外卖配送的完整工作流程，包括接单、取餐、送餐、换电等
- 🗺️ **动态环境**：基于种子生成的确定性地图，支持动态拥堵和订单潮汐
- 🔋 **资源管理**：智能体需要管理电量、承载能力、时间等多种资源
- 📊 **多维度评估**：从利润、准时率、路径效率、API 违规率等多个角度评估性能
- 🧪 **可重现性**：使用种子确保每次运行的地图和订单生成完全一致
- 🛠️ **工具调用**：提供 10 个标准工具 API，支持 OpenAI SDK 兼容的模型

## 安装

### 环境要求

- Node.js ≥ 18.0.0
- TypeScript ≥ 5.0.0
- OpenRouter API Key（或兼容 OpenAI SDK 的 API）

### 安装步骤

```bash
# 克隆仓库
git clone https://github.com/your-org/silicon-rider-bench.git
cd silicon-rider-bench

# 安装依赖
npm install

# 配置 API
cp .env.example .env
# 编辑 .env 文件，填入你的 API_KEY
```

### 配置说明

编辑 `.env` 文件：

```bash
# API Key（必需）- 支持 OpenRouter、OpenAI 等兼容服务
API_KEY=your_api_key_here

# 模型名称（可选，默认：anthropic/claude-3.5-sonnet）
MODEL_NAME=anthropic/claude-3.5-sonnet

# API Base URL（可选，默认：https://openrouter.ai/api/v1）
BASE_URL=https://openrouter.ai/api/v1

# 最大迭代次数（可选，默认：300）
# AI 模型的最大对话轮数，Level 1 可能需要 100-300 次迭代
MAX_ITERATIONS=300

# 站点 URL（可选，用于 OpenRouter 排名）
SITE_URL=

# 应用名称（可选）
APP_NAME=Silicon Rider Bench
```

## 使用指南

### 快速开始

```bash
# 运行 Level 0.1（教程场景，单订单完成）
npm run level0.1

# 运行 Level 1（完整基准测试，24 小时模拟）
npm run level1

# 运行测试套件
npm test

# 运行测试（带覆盖率报告）
npm run test:coverage
```

### 高级用法

```bash
# 使用自定义种子运行
npm run dev -- --level 1 --seed 12345

# 禁用实时可视化（提高性能）
npm run dev -- --level 1 --no-viz

# 指定输出报告文件
npm run dev -- --level 1 --output my-report.md

# 使用不同的 AI 模型
npm run dev -- --level 1 --model anthropic/claude-3-opus

# 组合多个选项
npm run dev -- --level 1 --seed 42 --model openai/gpt-4 --output gpt4-result.md

# 查看所有命令行选项
npm run dev -- --help
```

### 命令行选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--level` | `-l` | 指定关卡（0.1 或 1） | 1 |
| `--seed` | `-s` | 指定地图种子 | Level 配置默认值 |
| `--model` | `-m` | 指定 AI 模型名称 | .env 中的 MODEL_NAME |
| `--no-viz` | - | 禁用实时可视化 | false |
| `--output` | `-o` | 指定报告输出文件 | report.md |
| `--help` | `-h` | 显示帮助信息 | - |

### Level 说明

#### Level 0.1 - 教程场景

- **目标**：完成单个订单配送
- **时长**：60 分钟
- **地图**：小型地图（约 10 个节点）
- **订单**：1 个预设订单
- **用途**：验证 Agent 基本功能，测试工具调用序列

#### Level 1 - 完整基准测试

- **目标**：在 24 小时内最大化利润
- **时长**：1440 分钟（24 小时）
- **地图**：大型地图（50+ 节点）
- **订单**：动态生成，支持订单潮汐
- **特性**：
  - 动态拥堵（早晚高峰）
  - 订单潮汐（不同时段不同类型订单频率变化）
  - 多种订单类型（餐饮、超市、药店）
  - 资源管理（电量、承载能力）
  - 超时惩罚机制

## API 文档

### 工具调用接口

Silicon Rider Bench 提供 11 个标准工具 API，分为信息查询类和行动类。

#### 信息查询类工具

##### 1. get_my_status

获取智能体当前状态。

**参数**：无

**返回**：
```typescript
{
  position: string;           // 当前位置节点 ID
  battery: number;            // 电量百分比 (0-100)
  batteryRange: number;       // 剩余续航 (km)
  carriedOrders: Array<{     // 携带的订单列表
    id: string;
    type: string;
    weight: number;
    deadline: number;
  }>;
  totalWeight: number;        // 当前总重量 (kg)
  remainingCapacity: number;  // 剩余承载能力 (kg)
  currentTime: number;        // 当前游戏时间（分钟）
  profit: number;             // 当前利润（元）
}
```

##### 2. search_nearby_orders

搜索指定半径内的可用订单。

**参数**：
- `radius` (number, 必需): 搜索半径（km）

**返回**：
```typescript
{
  orders: Array<{
    id: string;
    type: 'food' | 'supermarket' | 'pharmacy';
    deliveryFee: number;        // 配送费（元）
    weight: number;             // 重量（kg）
    itemPrice: number;          // 商品价格（元）
    pickupLocation: string;     // 取餐地点 ID
    deliveryLocation: string;   // 送餐地点 ID
    distance: number;           // 配送距离（km）
    estimatedTimeLimit: number; // 配送时限（分钟）
  }>
}
```

##### 3. get_location_info

获取指定位置的详细信息。

**参数**：
- `locationId` (string, 必需): 位置节点 ID

**返回**：
```typescript
{
  id: string;
  type: 'restaurant' | 'supermarket' | 'pharmacy' | 'residential' | 'office' | 'battery_swap';
  name: string;
  position: { x: number; y: number };
}
```

##### 4. calculate_distance

计算两个位置之间的最短路径距离。

**参数**：
- `fromId` (string, 必需): 起点位置 ID
- `toId` (string, 必需): 终点位置 ID

**返回**：
```typescript
{
  distance: number;  // 距离（km）
  path: string[];    // 路径节点 ID 列表
}
```

##### 5. estimate_time

估算沿指定路径的总通行时间（考虑当前拥堵）。

**参数**：
- `locationIds` (string[], 必需): 位置 ID 列表（按顺序）

**返回**：
```typescript
{
  totalTime: number;  // 总时间（分钟）
  segments: Array<{
    from: string;
    to: string;
    distance: number;
    congestion: string;  // 拥堵程度
    speed: number;       // 速度（km/h）
    time: number;        // 时间（分钟）
  }>;
}
```

##### 6. help

显示帮助信息，包括所有可用工具、游戏规则和策略建议。

**参数**：无

**返回**：
```typescript
{
  help: string;  // 完整的帮助文档（Markdown 格式）
}
```

**说明**：
- 返回与初始系统提示词相同的内容
- 包含当前状态、所有工具说明、游戏规则和策略建议
- 当 AI 需要回顾规则或工具用法时可以调用

#### 行动类工具

##### 7. accept_order

接受一个订单，将其添加到携带订单列表。

**参数**：
- `orderId` (string, 必需): 订单 ID

**返回**：
```typescript
{
  success: boolean;
  order?: Order;  // 接受的订单详情
}
```

**错误码**：
- `INVALID_ORDER`: 订单不存在
- `CAPACITY_EXCEEDED`: 超过订单数量限制（5 单）
- `WEIGHT_EXCEEDED`: 超过重量限制（10kg）

##### 8. move_to

移动到指定位置，消耗时间和电量。

**参数**：
- `targetLocationId` (string, 必需): 目标位置 ID

**返回**：
```typescript
{
  success: boolean;
  timeCost: number;       // 时间消耗（分钟）
  batteryCost: number;    // 电量消耗（%）
  newPosition: string;    // 新位置 ID
  pushedDistance?: number; // 推行距离（如果途中没电）
}
```

**说明**：
- 电量充足时：速度由拥堵程度决定（15-30 km/h），每公里消耗 2% 电量
- 电量耗尽时：自动切换到推行模式（10 km/h），不消耗电量

##### 9. pickup_food

从餐厅取餐，标记订单为已取餐。

**参数**：
- `orderId` (string, 必需): 订单 ID

**返回**：
```typescript
{
  success: boolean;
  timeCost: number;  // 固定 2 分钟
}
```

**错误码**：
- `ORDER_NOT_CARRIED`: 订单不在携带列表中
- `WRONG_LOCATION`: 不在取餐地点

##### 10. deliver_food

将食物送达顾客，完成订单并获得报酬。

**参数**：
- `orderId` (string, 必需): 订单 ID

**返回**：
```typescript
{
  success: boolean;
  payment: number;   // 实际支付金额（元）
  overtime: number;  // 超时时长（分钟）
  penalty: number;   // 惩罚金额（元）
  timeCost: number;  // 固定 1 分钟
}
```

**超时惩罚规则**：
- 0-5 分钟：无惩罚
- 5-10 分钟：扣除 30%
- 10-15 分钟：扣除 50%
- 15 分钟以上：扣除 70%

**错误码**：
- `ORDER_NOT_CARRIED`: 订单不在携带列表中
- `ORDER_NOT_PICKED_UP`: 订单未取餐
- `WRONG_LOCATION`: 不在送餐地点

##### 11. swap_battery

在换电站更换电池，恢复电量到 100%。

**参数**：无

**返回**：
```typescript
{
  success: boolean;
  cost: number;      // 固定 0.5 元
  timeCost: number;  // 固定 1 分钟
  newBattery: number; // 100%
}
```

**错误码**：
- `NOT_AT_SWAP_STATION`: 不在换电站

### 错误处理

所有工具调用失败时返回统一的错误格式：

```typescript
{
  success: false;
  error: {
    code: string;      // 错误码
    message: string;   // 错误消息
    details?: any;     // 错误详情
  }
}
```

## 示例代码

### 基本工作流程

```typescript
// 1. 查询当前状态
const status = await callTool('get_my_status', {});
console.log(`当前位置: ${status.position}, 电量: ${status.battery}%`);

// 2. 搜索附近订单
const orders = await callTool('search_nearby_orders', { radius: 5 });
console.log(`找到 ${orders.orders.length} 个订单`);

// 3. 选择并接受订单
const bestOrder = orders.orders[0];
await callTool('accept_order', { orderId: bestOrder.id });

// 4. 移动到取餐点
await callTool('move_to', { targetLocationId: bestOrder.pickupLocation });

// 5. 取餐
await callTool('pickup_food', { orderId: bestOrder.id });

// 6. 移动到送餐点
await callTool('move_to', { targetLocationId: bestOrder.deliveryLocation });

// 7. 送餐
const result = await callTool('deliver_food', { orderId: bestOrder.id });
console.log(`获得报酬: ${result.payment} 元`);
```

### 路径规划示例

```typescript
// 计算多个订单的最优路径
const status = await callTool('get_my_status', {});
const currentPos = status.position;

// 获取所有订单的取餐点和送餐点
const locations = [
  currentPos,
  order1.pickupLocation,
  order1.deliveryLocation,
  order2.pickupLocation,
  order2.deliveryLocation,
];

// 估算总时间
const timeEstimate = await callTool('estimate_time', { locationIds: locations });
console.log(`预计总时间: ${timeEstimate.totalTime} 分钟`);

// 检查每段路程的拥堵情况
for (const segment of timeEstimate.segments) {
  console.log(`${segment.from} -> ${segment.to}: ${segment.congestion}, ${segment.time} 分钟`);
}
```

### 电量管理示例

```typescript
// 检查电量并决定是否换电
const status = await callTool('get_my_status', {});

if (status.battery < 20) {
  // 查找最近的换电站
  const nearbyLocations = await searchNearbyBatteryStations(status.position);
  const nearest = nearbyLocations[0];
  
  // 移动到换电站
  await callTool('move_to', { targetLocationId: nearest.id });
  
  // 换电
  await callTool('swap_battery', {});
  console.log('电量已恢复到 100%');
}
```

### 订单筛选示例

```typescript
// 搜索并筛选高价值订单
const orders = await callTool('search_nearby_orders', { radius: 10 });

// 筛选条件：配送费高、距离短、重量轻
const goodOrders = orders.orders.filter(order => {
  return order.deliveryFee > 10 &&  // 配送费 > 10 元
         order.distance < 5 &&       // 距离 < 5 km
         order.weight < 3;           // 重量 < 3 kg
});

// 按配送费排序
goodOrders.sort((a, b) => b.deliveryFee - a.deliveryFee);

// 接受最佳订单
if (goodOrders.length > 0) {
  await callTool('accept_order', { orderId: goodOrders[0].id });
}
```

## 评分指标

模拟结束后，系统会生成包含以下指标的评测报告：

### 核心指标

1. **总利润**：订单支付总和 - 换电成本
2. **准时率**：准时配送订单数 / 总配送订单数
3. **路径效率**：实际行驶距离 / 理论最优距离
4. **API 违规率**：无效工具调用数 / 总工具调用数

### 详细统计

- 完成订单数
- 总行驶距离
- 换电次数
- 平均每单利润
- 超时订单数
- 平均超时时长
- 订单类型分布

### 报告示例

```markdown
# Silicon Rider Bench - 评测报告

## 基本信息
- Level: 1
- Seed: 67890
- Duration: 24:00:00
- Model: anthropic/claude-3.5-sonnet

## 核心指标
- **总利润**: ¥1,234.50
- **完成订单数**: 87
- **准时率**: 82.8% (72/87)
- **路径效率**: 1.15
- **API 违规率**: 2.3% (12/520)

## 详细统计
- 总行驶距离: 145.6 km
- 换电次数: 4
- 平均每单利润: ¥14.19
- 超时订单数: 15
- 平均超时时长: 8.3 分钟
```

## 项目结构

```
silicon-rider-bench/
├── src/
│   ├── core/                    # 核心模块
│   │   ├── agent-state.ts       # 智能体状态管理
│   │   ├── game-clock.ts        # 游戏时钟
│   │   ├── simulator.ts         # 模拟器核心
│   │   ├── order-generator.ts   # 订单生成器
│   │   ├── fee-calculator.ts    # 配送费计算
│   │   ├── penalty-calculator.ts # 惩罚计算
│   │   └── movement-calculator.ts # 移动计算
│   ├── world/                   # 地图和世界管理
│   │   ├── map-generator.ts     # 地图生成器
│   │   ├── congestion-manager.ts # 拥堵管理
│   │   └── pathfinder.ts        # 路径查找
│   ├── tools/                   # 工具调用模块
│   │   ├── tool-registry.ts     # 工具注册
│   │   ├── tool-executor.ts     # 工具执行器
│   │   ├── query-tools.ts       # 查询工具
│   │   └── action-tools.ts      # 行动工具
│   ├── client/                  # AI 客户端
│   │   └── ai-client.ts         # OpenAI SDK 集成
│   ├── visualization/           # 可视化模块
│   │   └── terminal-display.ts  # 终端显示
│   ├── scoring/                 # 评分模块
│   │   ├── score-calculator.ts  # 评分计算
│   │   └── report-generator.ts  # 报告生成
│   ├── levels/                  # 关卡配置
│   │   └── level-config.ts      # Level 配置
│   ├── types/                   # TypeScript 类型定义
│   │   └── index.ts             # 类型定义
│   ├── utils/                   # 工具函数
│   │   └── seeded-rng.ts        # 种子随机数生成器
│   └── index.ts                 # 主程序入口
├── tests/                       # 测试文件
│   └── integration/             # 集成测试
│       ├── level0.1.test.ts
│       └── level1.test.ts
├── .env.example                 # 环境变量示例
├── package.json                 # 项目配置
├── tsconfig.json                # TypeScript 配置
└── vitest.config.ts             # 测试配置
```

## 开发

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 构建项目

```bash
# 编译 TypeScript
npm run build

# 运行编译后的代码
node dist/index.js --level 1
```

### 测试策略

项目采用双重测试策略：

1. **单元测试**：使用 Vitest，测试具体功能和边界条件
2. **属性测试**：使用 fast-check，验证通用属性（每个测试运行 100+ 次）

目标覆盖率：
- 工具调用模块：100%
- 核心计算函数：100%
- 整体代码：≥85%

## 常见问题

### Q: 如何获取 API Key？

A: 根据你使用的服务：
- **OpenRouter**: 访问 [OpenRouter](https://openrouter.ai/) 注册账号并获取 API Key
- **OpenAI**: 访问 [OpenAI Platform](https://platform.openai.com/) 获取 API Key
- **其他服务**: 参考对应服务的文档获取 API Key

### Q: 可以使用其他 AI 模型吗？

A: 可以！只要模型支持 OpenAI SDK 格式的工具调用，都可以使用。修改 `.env` 中的 `MODEL_NAME` 即可。

### Q: 如何调试 Agent 行为？

A: 
1. **启用 DEBUG 模式**：在 `.env` 中设置 `DEBUG=true` 或运行 `DEBUG=true npm run level0.1`
   - 这会显示完整的 AI 请求和响应 JSON
   - 包括所有 messages、tools 和 choices 的详细信息
2. 使用 `--no-viz` 禁用可视化，查看完整的工具调用日志
3. 使用固定种子（`--seed`）确保可重现性
4. 从 Level 0.1 开始测试基本功能

### Q: 评分标准是什么？

A: 主要看总利润，同时参考准时率、路径效率等指标。Level 1 中，优秀的 Agent 应该能在 24 小时内赚取 ¥1000+ 的利润。

### Q: 如何提高 Agent 性能？

A: 
1. 优化订单选择策略（高价值、短距离）
2. 合理规划路径，减少空驶
3. 及时换电，避免推行
4. 利用订单潮汐，在高峰期多接单
5. 注意承载能力，合理组合订单

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

## 致谢

感谢所有为这个项目做出贡献的开发者。
