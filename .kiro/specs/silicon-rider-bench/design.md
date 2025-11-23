# 设计文档

## 概述

Silicon Rider Bench 是一个基于 TypeScript 的 Agent 基准测试系统，用于评估 AI 模型在复杂决策场景中的表现。系统采用模块化架构，包含模拟器核心、AI 客户端、工具调用模块、可视化模块和评分模块。

系统模拟真实外卖配送场景，AI Agent 通过调用工具 API 在虚拟城市中导航、接单、取餐、送餐，同时管理电量、承载能力等资源约束。最终通过利润、准时率、路径效率等多维度指标评估 Agent 性能。

## 架构

### 整体架构

系统采用分层架构设计：

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent (External)                   │
│                  (OpenAI SDK / OpenRouter)               │
└────────────────────────┬────────────────────────────────┘
                         │ Tool Calls
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   Client Module                          │
│  - API Configuration (.env)                              │
│  - OpenAI SDK Integration                                │
│  - Tool Call Dispatcher                                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│                 Tool Call Module                         │
│  - Tool Registry                                         │
│  - Parameter Validation                                  │
│  - Tool Execution                                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  Simulator Core                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ World       │  │ Game Clock   │  │ Agent State    │ │
│  │ - Map       │  │ - Time       │  │ - Position     │ │
│  │ - Nodes     │  │ - Events     │  │ - Battery      │ │
│  │ - Edges     │  │              │  │ - Orders       │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐                     │
│  │ Order Pool  │  │ Congestion   │                     │
│  │ - Available │  │ - Dynamic    │                     │
│  │ - Accepted  │  │ - Time-based │                     │
│  └─────────────┘  └──────────────┘                     │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ↓                             ↓
┌──────────────────────┐    ┌──────────────────────┐
│ Visualization Module │    │   Scoring Module     │
│ - Terminal Display   │    │ - Profit Tracking    │
│ - Real-time Updates  │    │ - Metrics Calculation│
│ - Map Rendering      │    │ - Report Generation  │
└──────────────────────┘    └──────────────────────┘
```

### 模块职责

**Client Module（客户端模块）**
- 加载 .env 配置
- 初始化 OpenAI SDK 连接到 OpenRouter
- 接收 AI 模型的工具调用请求
- 将工具调用分发到 Tool Call Module
- 返回执行结果给 AI 模型

**Tool Call Module（工具调用模块）**
- 注册所有可用工具
- 验证工具名称和参数
- 执行工具函数
- 返回结构化结果或错误

**Simulator Core（模拟器核心）**
- 管理游戏世界状态
- 处理时间推进
- 执行游戏逻辑
- 维护订单池
- 计算拥堵和速度

**Visualization Module（可视化模块）**
- 实时显示 Agent 状态
- 渲染地图和位置
- 更新统计信息

**Scoring Module（评分模块）**
- 跟踪利润变化
- 计算性能指标
- 生成 Markdown 报告

## 组件和接口

### 核心数据结构

#### Node（节点）
```typescript
interface Node {
  id: string;
  type: 'restaurant' | 'supermarket' | 'pharmacy' | 'residential' | 'office' | 'battery_swap';
  position: { x: number; y: number };
  name: string;
}
```

#### Edge（边）
```typescript
interface Edge {
  from: string;  // Node ID
  to: string;    // Node ID
  distance: number;  // km
  baseCongestion: number;  // 0-1
}
```

#### Order（订单）
```typescript
interface Order {
  id: string;
  type: 'food' | 'supermarket' | 'pharmacy';
  pickupLocation: string;  // Node ID
  deliveryLocation: string;  // Node ID
  distance: number;  // km
  itemPrice: number;  // 元
  deliveryFee: number;  // 元（总配送费）
  weight: number;  // kg
  timeLimit: number;  // 分钟
  acceptedAt?: number;  // 游戏时间（分钟）
  deadline?: number;  // 游戏时间（分钟）
  pickedUp: boolean;
  delivered: boolean;
}
```

#### AgentState（智能体状态）
```typescript
interface AgentState {
  position: string;  // Node ID
  battery: number;  // 0-100%
  carriedOrders: Order[];
  totalWeight: number;  // kg
  profit: number;  // 元
  completedOrders: number;
  totalDistance: number;  // km
}
```

#### WorldState（世界状态）
```typescript
interface WorldState {
  nodes: Map<string, Node>;
  edges: Edge[];
  currentTime: number;  // 游戏时间（分钟，0-1440）
  seed: number;
  congestionMap: Map<string, number>;  // Edge ID -> congestion level
}
```

### Tool API 接口

#### 信息查询类

**get_my_status()**
```typescript
{
  position: string;
  battery: number;
  batteryRange: number;  // 剩余续航 km
  carriedOrders: Array<{
    id: string;
    type: string;
    weight: number;
    deadline: number;
  }>;
  totalWeight: number;
  remainingCapacity: number;  // 10 - totalWeight
  currentTime: number;
  profit: number;
}
```

**search_nearby_orders(radius: number)**
```typescript
{
  orders: Array<{
    id: string;
    type: 'food' | 'supermarket' | 'pharmacy';
    deliveryFee: number;
    weight: number;
    itemPrice: number;
    pickupLocation: string;
    deliveryLocation: string;
    distance: number;
    estimatedTimeLimit: number;
  }>
}
```

**get_location_info(locationId: string)**
```typescript
{
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
}
```

**calculate_distance(fromId: string, toId: string)**
```typescript
{
  distance: number;  // km
  path: string[];  // Node IDs
}
```

**estimate_time(locationIds: string[])**
```typescript
{
  totalTime: number;  // 分钟
  segments: Array<{
    from: string;
    to: string;
    distance: number;
    congestion: string;
    speed: number;
    time: number;
  }>;
}
```

#### 行动类

**accept_order(orderId: string)**
```typescript
{
  success: boolean;
  message?: string;
  order?: Order;
}
```

**move_to(targetLocationId: string)**
```typescript
{
  success: boolean;
  timeCost: number;  // 分钟
  batteryCost: number;  // %
  newPosition: string;
  pushedDistance?: number;  // 如果途中没电，推行的距离
}
```

**pickup_food(orderId: string)**
```typescript
{
  success: boolean;
  timeCost: number;  // 固定 2 分钟
  message?: string;
}
```

**deliver_food(orderId: string)**
```typescript
{
  success: boolean;
  payment: number;  // 实际支付金额（扣除惩罚后）
  overtime: number;  // 超时分钟数
  penalty: number;  // 惩罚金额
  timeCost: number;  // 固定 1 分钟
}
```

**swap_battery()**
```typescript
{
  success: boolean;
  cost: number;  // 0.5 元
  timeCost: number;  // 1 分钟
  newBattery: number;  // 100%
}
```

### 地图生成算法

使用种子随机数生成器（Seeded RNG）确保可重现性：

1. **节点生成**
   - 使用种子初始化随机数生成器
   - 在网格空间中随机放置节点
   - 节点类型分布：
     - 餐厅：30-40%
     - 超市：10-15%
     - 药店：5-10%
     - 居民区：20-30%
     - 写字楼：10-15%
     - 换电站：5-10%

2. **边生成**
   - 使用 Delaunay 三角剖分或 K-近邻算法连接节点
   - 计算欧几里得距离作为边长度
   - 为每条边分配基础拥堵程度（0.1-0.3）

3. **拥堵动态更新**
   - 根据当前游戏时间计算拥堵系数
   - 早高峰（7-9）：地图边缘 +0.3
   - 晚高峰（17-19）：地图中心 +0.3
   - 其他时段：使用基础拥堵

### 订单生成系统

**订单生成频率**
- 基准频率：每 5 分钟生成 1-3 个订单
- 潮汐倍数应用：
  - 早高峰（6:00-9:00）：餐饮 ×3
  - 午高峰（10:30-12:30）：餐饮 ×4
  - 下午小高峰（15:00-17:00）：超市 ×3
  - 晚高峰（18:00-20:00）：餐饮 ×4
  - 夜宵（21:00-24:00）：餐饮 ×2
  - 深夜（0:00-6:00）：药店 ×2

**订单属性生成**
1. 随机选择取餐点和送餐点
2. 计算配送距离
3. 根据订单类型生成重量：
   - 餐饮：0.5-1kg
   - 超市：5-10kg
   - 药店：0.05-0.2kg
4. 生成商品价格（10-100元）
5. 计算配送费（距离费 + 价格费 + 时段费）
6. 计算配送时限（距离 < 3km: 20分钟，否则 20 + (距离-3)×3）

### 配送费计算

**距离费**
```typescript
function calculateDistanceFee(distance: number): number {
  if (distance <= 3) {
    return 3.65;
  } else if (distance <= 4) {
    return 3.65 + (distance - 3) * 10 * 0.15;
  } else {
    return 3.65 + 10 * 0.15 + (distance - 4) * 10 * 0.1;
  }
}
```

**价格费**
```typescript
function calculatePriceFee(itemPrice: number): number {
  if (itemPrice <= 25) {
    return 0;
  } else if (itemPrice <= 30) {
    return (itemPrice - 25) * 0.19;
  } else if (itemPrice <= 50) {
    return 5 * 0.19 + (itemPrice - 30) * 0.18;
  } else {
    return 5 * 0.19 + 20 * 0.18 + (itemPrice - 50) * 0.17;
  }
}
```

**时段费**
```typescript
function calculateTimeSlotFee(acceptTime: number): number {
  const hour = Math.floor(acceptTime / 60);
  if (hour > 0 && hour <= 2) return 0.5;
  if (hour > 2 && hour <= 6) return 1.0;
  if (hour > 22 && hour <= 24) return 0.3;
  return 0;
}
```

### 移动和电量系统

**速度计算**
```typescript
function getSpeed(congestion: number, battery: number): number {
  if (battery <= 0) return 10;  // 推行
  
  if (congestion < 0.3) return 30;      // 正常
  if (congestion < 0.5) return 25;      // 轻度拥堵
  if (congestion < 0.7) return 20;      // 中度拥堵
  return 15;                             // 重度拥堵
}
```

**移动时间和电量消耗**
```typescript
function move(from: string, to: string, battery: number): MoveResult {
  const distance = calculateDistance(from, to);
  const congestion = getCongestion(from, to);
  const batteryRange = battery * 0.5;  // 满电 50km
  
  if (batteryRange >= distance) {
    // 电量充足
    const speed = getSpeed(congestion, battery);
    const time = (distance / speed) * 60;  // 分钟
    const batteryCost = (distance / 50) * 100;  // %
    return { time, batteryCost, pushedDistance: 0 };
  } else {
    // 途中没电
    const ridingDistance = batteryRange;
    const pushingDistance = distance - ridingDistance;
    
    const ridingSpeed = getSpeed(congestion, battery);
    const ridingTime = (ridingDistance / ridingSpeed) * 60;
    const pushingTime = (pushingDistance / 10) * 60;
    
    return {
      time: ridingTime + pushingTime,
      batteryCost: battery,  // 耗尽所有电量
      pushedDistance: pushingDistance
    };
  }
}
```

### 超时惩罚计算

```typescript
function calculatePayment(order: Order, deliveryTime: number): Payment {
  const overtime = Math.max(0, deliveryTime - order.deadline);
  let penaltyRate = 0;
  
  if (overtime <= 5) {
    penaltyRate = 0;
  } else if (overtime <= 10) {
    penaltyRate = 0.3;
  } else if (overtime <= 15) {
    penaltyRate = 0.5;
  } else {
    penaltyRate = 0.7;
  }
  
  const penalty = order.deliveryFee * penaltyRate;
  const payment = order.deliveryFee - penalty;
  
  return { payment, penalty, overtime };
}
```

## 数据模型

### 持久化数据

系统运行时的状态保存在内存中，模拟结束后生成报告。不需要数据库持久化。

### 配置文件

**.env**
```
API_KEY=your_api_key
MODEL_NAME=anthropic/claude-3.5-sonnet
BASE_URL=https://openrouter.ai/api/v1
```

**level-config.json**
```json
{
  "level0.1": {
    "duration": 60,
    "mapSize": "small",
    "orderCount": 1,
    "seed": 12345
  },
  "level1": {
    "duration": 1440,
    "mapSize": "large",
    "seed": 67890,
    "baseOrderFrequency": 5
  }
}
```


## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：种子确定性
*对于任意*种子值，使用该种子多次生成地图应该产生完全相同的节点、边和属性
**验证：需求 1.2**

### 属性 2：地图完整性
*对于任意*生成的地图，应该包含所有类型的节点（餐厅、超市、药店、居民区、写字楼、换电站），且所有边都应该具有距离和拥堵属性
**验证：需求 1.3, 1.4**

### 属性 3：拥堵到速度映射
*对于任意*拥堵程度值，应该映射到正确的骑行速度：正常(<0.3)→30km/h，轻度(0.3-0.5)→25km/h，中度(0.5-0.7)→20km/h，重度(≥0.7)→15km/h
**验证：需求 2.4, 2.5, 2.6, 2.7**

### 属性 4：时间推进一致性
*对于任意*操作，执行后游戏时钟应该推进该操作的时间成本，且时钟值应该单调递增
**验证：需求 3.2**

### 属性 5：状态查询完整性
*对于任意*游戏状态，调用 get_my_status 应该返回包含位置、电量、订单列表、重量、承载能力和当前时间的完整信息
**验证：需求 4.1, 4.2, 4.3, 4.4, 4.5**

### 属性 6：订单搜索范围正确性
*对于任意*位置和半径，search_nearby_orders 返回的所有订单的取餐点距离应该都在指定半径内
**验证：需求 5.1**

### 属性 7：订单信息完整性
*对于任意*订单，返回的信息应该包含 ID、类型、配送费、重量、商品价格、取餐地点、送餐地点和配送距离
**验证：需求 5.2**

### 属性 8：已接受订单排除
*对于任意*已被接受的订单，在任何搜索结果中都不应该出现
**验证：需求 5.3**

### 属性 9：订单数量限制
*对于任意*智能体状态，当携带订单数量达到 5 单时，尝试接受新订单应该被拒绝并返回错误
**验证：需求 6.2**

### 属性 10：重量限制
*对于任意*智能体状态和新订单，当当前总重量加上新订单重量超过 10kg 时，接单应该被拒绝并返回错误
**验证：需求 6.3**

### 属性 11：接单后订单移除
*对于任意*成功接受的订单，该订单应该从可用订单池中移除，且出现在智能体的携带订单列表中
**验证：需求 6.1, 6.4**

### 属性 12：移动位置更新
*对于任意*有效的移动操作，智能体的位置应该更新到目标位置
**验证：需求 7.1**

### 属性 13：电量消耗比例
*对于任意*移动距离 d（km），当电量充足时，电量消耗应该等于 d × 2%
**验证：需求 7.3**

### 属性 14：移动时间计算
*对于任意*移动，当电量充足时，通行时间应该等于 (距离 / 速度) × 60 分钟，其中速度由拥堵程度决定
**验证：需求 7.2, 2.8**

### 属性 15：取餐位置验证
*对于任意*取餐操作，只有当智能体位于订单的取餐地点时才能成功，否则应该返回错误
**验证：需求 8.2**

### 属性 16：取餐时间推进
*对于任意*成功的取餐操作，游戏时钟应该推进固定的取餐时间（2分钟）
**验证：需求 8.4**

### 属性 17：送餐位置验证
*对于任意*送餐操作，只有当智能体位于订单的送餐地点时才能成功，否则应该返回错误
**验证：需求 9.4**

### 属性 18：超时惩罚计算
*对于任意*送达订单，最终支付金额应该等于配送费 × (1 - 惩罚比例)，其中惩罚比例根据超时时长确定：0-5分钟→0%，5-10分钟→30%，10-15分钟→50%，>15分钟→70%
**验证：需求 9.3, 22.1, 22.2, 22.3, 22.4, 22.5**

### 属性 19：送餐后订单移除
*对于任意*成功送达的订单，该订单应该从携带订单列表中移除，且总重量应该减少该订单的重量
**验证：需求 9.5, 20.4**

### 属性 20：换电效果
*对于任意*在换电站的换电操作，电量应该恢复到 100%，利润应该减少 0.5 元，游戏时钟应该推进 1 分钟
**验证：需求 10.1, 10.2, 10.4**

### 属性 21：电池续航计算
*对于任意*电量百分比 b，剩余续航应该等于 b × 0.5 km（满电 50km）
**验证：需求 10.5**

### 属性 22：距离计算对称性
*对于任意*两个位置 A 和 B，calculate_distance(A, B) 应该等于 calculate_distance(B, A)
**验证：需求 11.1**

### 属性 23：配送时限计算
*对于任意*订单距离 d（km），配送时限应该等于：d ≤ 3 时为 20 分钟，d > 3 时为 20 + (d - 3) × 3 分钟
**验证：需求 21.1, 21.2**

### 属性 24：距离配送费计算
*对于任意*配送距离 d（km），距离费应该等于：d ≤ 3 时为 3.65 元，3 < d ≤ 4 时为 3.65 + (d-3)×10×0.15 元，d > 4 时为 3.65 + 1.5 + (d-4)×10×0.1 元
**验证：需求 23.1, 23.2, 23.3**

### 属性 25：价格配送费计算
*对于任意*商品价格 p（元），价格费应该等于：p ≤ 25 时为 0 元，25 < p ≤ 30 时为 (p-25)×0.19 元，30 < p ≤ 50 时为 0.95 + (p-30)×0.18 元，p > 50 时为 0.95 + 3.6 + (p-50)×0.17 元
**验证：需求 24.1, 24.2, 24.3, 24.4**

### 属性 26：时段配送费计算
*对于任意*接单时间 t（小时），时段费应该等于：0 < t ≤ 2 时为 0.5 元，2 < t ≤ 6 时为 1 元，22 < t ≤ 24 时为 0.3 元，其他时段为 0 元
**验证：需求 25.1, 25.2, 25.3, 25.4**

### 属性 27：总配送费计算
*对于任意*订单，总配送费应该等于距离配送费 + 价格配送费 + 时段配送费
**验证：需求 26.1, 26.2**

### 属性 28：订单类型重量范围
*对于任意*生成的订单，重量应该在类型对应的范围内：餐饮(0.5-1kg)，超市(5-10kg)，药店(0.05-0.2kg)
**验证：需求 19.1, 19.2, 19.4**

### 属性 29：订单潮汐频率
*对于任意*时段，订单生成频率应该符合潮汐规则：早高峰(6-9)餐饮×3，午高峰(10:30-12:30)餐饮×4，下午(15-17)超市×3，晚高峰(18-20)餐饮×4，夜宵(21-24)餐饮×2，深夜(0-6)药店×2
**验证：需求 18.1, 18.2, 18.3, 18.4, 18.5, 18.6**

### 属性 30：工具调用验证
*对于任意*工具调用请求，如果工具名称无效或参数不符合要求，应该返回结构化错误消息而不是执行
**验证：需求 17.1, 17.3**

### 属性 31：评分指标计算
*对于任意*模拟结果，总利润应该等于所有订单支付之和减去换电成本，准时率应该等于准时订单数/总订单数，路径效率应该等于实际距离/理论最优距离
**验证：需求 14.1, 14.2, 14.3**

## 错误处理

### 工具调用错误

所有工具调用都应该返回统一的错误格式：

```typescript
interface ToolError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

**错误类型：**

1. **INVALID_PARAMETER** - 参数无效或缺失
2. **INVALID_LOCATION** - 位置 ID 不存在
3. **INVALID_ORDER** - 订单 ID 不存在或无效
4. **CAPACITY_EXCEEDED** - 超过订单数量限制（5单）
5. **WEIGHT_EXCEEDED** - 超过重量限制（10kg）
6. **WRONG_LOCATION** - 不在正确位置执行操作
7. **ORDER_NOT_CARRIED** - 订单不在携带列表中
8. **ORDER_NOT_PICKED_UP** - 订单未取餐
9. **BATTERY_DEPLETED** - 电量耗尽无法移动
10. **NOT_AT_SWAP_STATION** - 不在换电站

### 状态一致性保证

- 所有操作都是原子性的：要么完全成功，要么完全失败
- 失败的操作不会改变任何状态
- 时间只在成功的操作后推进
- 订单状态转换是单向的：available → accepted → picked_up → delivered

### 边界条件处理

1. **电量耗尽**：途中没电时自动切换到推行模式，分段计算时间
2. **订单过期**：自动从可用订单池中移除
3. **时间到达终点**：立即终止模拟，计算最终分数
4. **地图边界**：所有节点都在有效范围内，不存在无法到达的位置

## 测试策略

### 单元测试

使用 **Vitest** 作为测试框架。

**核心模块测试：**

1. **地图生成测试**
   - 测试种子确定性
   - 测试节点类型分布
   - 测试边的连接性

2. **配送费计算测试**
   - 测试距离费边界值（3km, 4km）
   - 测试价格费边界值（25元, 30元, 50元）
   - 测试时段费边界值（2点, 6点, 22点）
   - 测试总费用计算

3. **超时惩罚测试**
   - 测试各个惩罚区间（5分钟, 10分钟, 15分钟）
   - 测试边界值

4. **移动和电量测试**
   - 测试正常移动的时间和电量消耗
   - 测试途中没电的分段计算
   - 测试推行模式

5. **订单生成测试**
   - 测试订单潮汐频率
   - 测试订单类型重量范围
   - 测试配送时限计算

6. **工具调用测试**
   - 测试所有工具的正常流程
   - 测试所有错误情况
   - 测试参数验证

### 属性测试

使用 **fast-check** 作为属性测试库，每个属性测试运行至少 100 次迭代。

**属性测试标注格式：**
```typescript
// Feature: silicon-rider-bench, Property 1: 种子确定性
```

**关键属性测试：**

1. **属性 1-2**：地图生成的确定性和完整性
2. **属性 3-4**：拥堵和时间系统
3. **属性 13-14**：移动时间和电量计算
4. **属性 18**：超时惩罚计算
5. **属性 23-27**：配送费和时限计算
6. **属性 28-29**：订单生成规则

### 集成测试

1. **Level 0.1 完整流程测试**
   - 验证基本工具调用序列
   - 验证单订单完成流程

2. **Level 1 场景测试**
   - 验证 24 小时模拟
   - 验证订单潮汐效果
   - 验证评分计算

### 测试覆盖率目标

- 工具调用模块：100% 覆盖率
- 核心计算函数：100% 覆盖率
- 模拟器逻辑：≥90% 覆盖率
- 整体代码：≥85% 覆盖率

### 测试数据生成

使用 fast-check 的生成器：

```typescript
// 生成有效的种子
const seedArbitrary = fc.integer({ min: 0, max: 999999 });

// 生成订单距离
const distanceArbitrary = fc.float({ min: 0.5, max: 10, noNaN: true });

// 生成商品价格
const priceArbitrary = fc.float({ min: 5, max: 150, noNaN: true });

// 生成游戏时间（分钟）
const timeArbitrary = fc.integer({ min: 0, max: 1440 });

// 生成电量百分比
const batteryArbitrary = fc.integer({ min: 0, max: 100 });

// 生成订单重量
const weightArbitrary = fc.oneof(
  fc.float({ min: 0.5, max: 1 }),      // 餐饮
  fc.float({ min: 5, max: 10 }),       // 超市
  fc.float({ min: 0.05, max: 0.2 })    // 药店
);
```

### 性能测试

1. **地图生成性能**：大地图（100+ 节点）生成应在 1 秒内完成
2. **路径计算性能**：最短路径计算应在 100ms 内完成
3. **订单搜索性能**：搜索 1000+ 订单池应在 50ms 内完成
4. **模拟性能**：24 小时模拟应在 30 秒内完成

### 测试执行策略

1. **开发阶段**：每次代码修改后运行单元测试
2. **提交前**：运行所有单元测试和属性测试
3. **CI/CD**：自动运行完整测试套件，包括集成测试
4. **发布前**：运行性能测试和完整的 Level 1 场景测试

## 部署和运行

### 环境要求

- Node.js ≥ 18.0.0
- TypeScript ≥ 5.0.0
- 支持的操作系统：Windows, macOS, Linux

### 安装和配置

```bash
# 安装依赖
npm install

# 配置 API
cp .env.example .env
# 编辑 .env 文件，填入 API_KEY

# 运行测试
npm test

# 运行 Level 0.1
npm run level0.1

# 运行 Level 1
npm run level1
```

### 输出格式

**终端实时显示：**
```
╔════════════════════════════════════════════════════════════╗
║  Silicon Rider Bench - Level 1                             ║
║  Time: 08:45 | Battery: 78% | Profit: ¥45.30              ║
║  Orders: 3/5 (8.2kg/10kg) | Completed: 12                  ║
╠════════════════════════════════════════════════════════════╣
║  [Map Display]                                             ║
║  🏠 = Residential  🏢 = Office  🍔 = Restaurant            ║
║  🔋 = Swap Station  🚴 = Agent                            ║
╚════════════════════════════════════════════════════════════╝
```

**最终报告（Markdown）：**
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

## 订单类型分布
- 餐饮订单: 65 (74.7%)
- 超市订单: 15 (17.2%)
- 药店订单: 7 (8.1%)
```

## 扩展性考虑

### 未来多模态支持

当前设计为纯文本模态，但架构支持未来扩展：

1. **图像输入**：地图可以渲染为图像传递给多模态模型
2. **视觉订单信息**：订单可以包含商品图片
3. **实时地图视图**：Agent 可以接收当前视野范围的地图截图

### 难度扩展

可以通过配置调整难度：

1. **地图复杂度**：增加节点数量和连接复杂度
2. **订单密度**：调整订单生成频率
3. **时间压力**：缩短配送时限
4. **资源约束**：减少换电站数量，增加换电成本
5. **动态事件**：添加突发拥堵、订单取消等事件

### 多智能体竞争

架构支持扩展为多智能体竞争场景：

1. 多个 Agent 同时运行
2. 订单先到先得
3. 排行榜和相对评分
