/**
 * 系统提示词生成模块
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 职责：
 * - 生成系统提示词
 * - 提供帮助信息
 * - 确保提示词在不同地方使用时保持一致
 */

import { Simulator } from '../core/simulator';

/**
 * Tool Call 格式类型
 */
export type ToolCallFormat = 'openai' | 'sglang' | 'mcp';

/**
 * 获取 Tool Call 格式（从环境变量读取）
 */
export function getToolCallFormat(): ToolCallFormat {
  const envValue = process.env.TOOL_CALL_FORMAT?.toLowerCase();
  if (envValue === 'sglang' || envValue === 'mcp') {
    return envValue;
  }
  return 'openai'; // 默认值
}

/**
 * 获取最大迭代次数（从环境变量读取）
 * 返回 0 表示无限循环
 */
function getMaxIterations(): number {
  const envValue = process.env.MAX_ITERATIONS;
  if (envValue !== undefined && envValue !== '') {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 300; // 默认值
}

/**
 * 生成 MCP 格式的 Tool Call 使用说明
 */
function generateMCPToolCallInstructions(): string {
  return `
## Tool Call 格式说明

本系统使用 MCP (Model Context Protocol) 格式进行工具调用。工具调用使用 XML 风格标签格式化。

### 使用格式
\`\`\`xml
<use_mcp_tool>
<server_name>silicon-rider</server_name>
<tool_name>工具名称</tool_name>
<arguments>
{
  "参数名": "参数值"
}
</arguments>
</use_mcp_tool>
\`\`\`

### 重要说明
- server_name 固定为 \`silicon-rider\`
- tool_name 必须是下方列出的可用工具名称
- arguments 必须是有效的 JSON 格式
- 字符串中的引号需要转义，例如 \`"value \\"escaped\\""\`
- 工具调用必须放在回复的**末尾**，不能嵌套在其他标签内

### 示例
查询当前状态：
\`\`\`xml
<use_mcp_tool>
<server_name>silicon-rider</server_name>
<tool_name>get_my_status</tool_name>
<arguments>
{}
</arguments>
</use_mcp_tool>
\`\`\`

搜索附近订单：
\`\`\`xml
<use_mcp_tool>
<server_name>silicon-rider</server_name>
<tool_name>search_nearby_orders</tool_name>
<arguments>
{
  "radius": 5
}
</arguments>
</use_mcp_tool>
\`\`\`
`;
}

/**
 * 生成 SGLang 格式的 Tool Call 使用说明
 */
function generateSGLangToolCallInstructions(): string {
  return `
## Tool Call 格式说明

本系统使用 SGLang XML 格式进行工具调用。

### 使用格式
你可以先在 \`<think>\` 标签中进行思考，然后使用 \`<tool_call>\` 标签调用工具：

\`\`\`xml
<think>
这里是你的思考过程...
</think>
<tool_call>
{"name": "工具名称", "arguments": {"参数名": "参数值"}}
</tool_call>
\`\`\`

### 重要说明
- \`<think>\` 标签是可选的，用于展示推理过程
- \`<tool_call>\` 标签内必须是有效的 JSON 格式
- JSON 必须包含 \`name\` 和 \`arguments\` 字段
- 可以在一次回复中调用多个工具（使用多个 \`<tool_call>\` 标签）

### 示例
查询当前状态：
\`\`\`xml
<think>
我需要先了解当前的状态，包括位置、电量等信息。
</think>
<tool_call>
{"name": "get_my_status", "arguments": {}}
</tool_call>
\`\`\`

搜索附近订单：
\`\`\`xml
<tool_call>
{"name": "search_nearby_orders", "arguments": {"radius": 5}}
</tool_call>
\`\`\`
`;
}

/**
 * 生成 OpenAI 格式的 Tool Call 使用说明（默认，无需特殊说明）
 */
function generateOpenAIToolCallInstructions(): string {
  // OpenAI 格式是默认格式，SDK 会自动处理，不需要特殊说明
  return '';
}

/**
 * 生成 V1 版本的工具说明
 */
function generateV1ToolsPrompt(): string {
  return `
## 可用工具
你可以调用以下工具来完成配送任务, 一次对话支持同时调用多个工具, 但是工具调用的先后顺序有区别, 请根据实际情况选择：

### 信息查询类
- **get_my_status()**: 查询当前状态（位置、电量、订单、利润等）
- **get_map()**: 获取完整地图信息（位置列表按类型分组 + 邻接表连接关系）
- **search_nearby_orders(radius)**: 搜索指定半径内的可用订单
- **search_nearby_battery_stations(radius)**: 搜索指定半径内的换电站
- **get_location_info(locationId)**: 获取位置详细信息（包括相邻位置和距离）
- **calculate_distance(fromId, toId)**: 计算两点间最短距离
- **estimate_time(locationIds)**: 估算路径通行时间（考虑拥堵）
- **help()**: 显示此帮助信息

### 行动类
- **accept_order(orderId)**: 接受订单（最多 5 单，总重量不超过 10kg）
- **move_to(targetLocationId)**: 移动到目标位置
- **pickup_food(orderId)**: 在取餐点取餐（耗时 2 分钟）
- **deliver_food(orderId)**: 在送餐点送餐（耗时 1 分钟）
- **swap_battery()**: 在换电站换电（耗时 1 分钟，花费 0.5 元）
- **wait(minutes)**: 等待指定分钟数（1-60），在此期间会生成新订单`;
}

/**
 * 生成 V2 版本的工具说明（多模态取餐）
 */
function generateV2ToolsPrompt(): string {
  return `
## 可用工具
你可以调用以下工具来完成配送任务, 一次对话支持同时调用多个工具, 但是工具调用的先后顺序有区别, 请根据实际情况选择：

### 信息查询类
- **get_my_status()**: 查询当前状态（位置、电量、订单、利润等）
- **get_map()**: 获取完整地图信息（位置列表按类型分组 + 邻接表连接关系）
- **search_nearby_orders(radius)**: 搜索指定半径内的可用订单
- **search_nearby_battery_stations(radius)**: 搜索指定半径内的换电站
- **get_location_info(locationId)**: 获取位置详细信息（包括相邻位置和距离）
- **calculate_distance(fromId, toId)**: 计算两点间最短距离
- **estimate_time(locationIds)**: 估算路径通行时间（考虑拥堵）
- **help()**: 显示此帮助信息

### 行动类
- **accept_order(orderId)**: 接受订单（最多 5 单，总重量不超过 10kg）
- **move_to(targetLocationId)**: 移动到目标位置
- **get_receipts(targetLocationId)**: 获取当前地点的外卖小票图片（包含当前订单所需要的信息, 需要识别图片中的手机号）
- **pickup_food_by_phone_number(phoneNumber)**: 通过手机号取餐（手机号格式如 172****3882）
- **deliver_food(orderId)**: 在送餐点送餐（耗时 1 分钟）
- **swap_battery()**: 在换电站换电（耗时 1 分钟，花费 0.5 元）
- **wait(minutes)**: 等待指定分钟数（1-60），在此期间会生成新订单

### ⚠️ 重要：取餐流程
取餐需要通过识别小票图片来获取手机号：
1. 到达取餐点后，调用 **get_receipts(targetLocationId)** 获取小票图片
2. **注意：餐厅可能同时存在多张小票（包括其他顾客的订单）**，你需要仔细识别每张小票上的菜品信息，找到与你所接订单匹配的小票
3. 在正确的小票上识别手机号（格式如 172****3882）
4. 使用识别到的手机号调用 **pickup_food_by_phone_number(phoneNumber)** 完成取餐

### ⚠️ 如何识别正确的小票
- 你接单时会获得订单的菜品信息
- 对比小票上的菜品列表与你接单时获得的菜品信息
- 找到菜品完全匹配的小票，那就是你需要取餐的订单
- 使用该小票上的手机号进行取餐`;
}

/**
 * 生成 V1 版本的规则说明
 */
function generateV1RulesPrompt(): string {
  return `
## 重要规则
1. **电量管理**：满电续航 50km，每公里消耗 2% 电量。电量耗尽后只能推行（10km/h）
2. **承载限制**：最多携带 5 单，总重量不超过 10kg
3. **订单类型**：
   - 餐饮订单：0.5-1kg，配送费较低
   - 超市订单：5-10kg，配送费较高
   - 药店订单：0.05-0.2kg，配送费最高
4. **超时惩罚**：
   - 准时送达（0 分钟）：无惩罚
   - 超时 0（不含）- 5 分钟：扣除 30% 配送费
   - 超时 5（不含）- 10 分钟：扣除 50% 配送费
   - 超时 10（不含）- 20 分钟：扣除所有配送费（100%）
   - 超时 20 分钟以上：扣除 100% 配送费并在不挣钱基础上追加罚款 10 元
   - 注意: 如果电量耗尽, 以推行的速度配送, 会有很大概率导致超时
5. **拥堵影响**：道路拥堵会降低速度（30/25/20/15 km/h）
6. **订单潮汐**：不同时段不同类型订单频率不同`;
}

/**
 * 生成 V2 版本的规则说明（只有外卖订单）
 */
function generateV2RulesPrompt(): string {
  return `
## 重要规则
1. **电量管理**：满电续航 50km，每公里消耗 2% 电量。电量耗尽后只能推行（10km/h）
2. **承载限制**：最多携带 5 单，总重量不超过 10kg
3. **订单类型**：本场景只有外卖订单（0.5-1kg）
4. **超时惩罚**：
   - 准时送达（0 分钟）：无惩罚
   - 超时 0（不含）- 5 分钟：扣除 30% 配送费
   - 超时 5（不含）- 10 分钟：扣除 50% 配送费
   - 超时 10（不含）- 20 分钟：扣除所有配送费（100%）
   - 超时 20 分钟以上：扣除 100% 配送费并在不挣钱基础上追加罚款 10 元
   - 注意: 如果电量耗尽, 以推行的速度配送, 会有很大概率导致超时
5. **拥堵影响**：道路拥堵会降低速度（30/25/20/15 km/h）
6. **订单潮汐**：不同时段订单频率不同`;
}

/**
 * 生成 V1 版本的配送流程说明
 */
function generateV1WorkflowPrompt(isLevel01: boolean): string {
  return `
## 配送流程（必须严格遵守）
完成一个订单的完整流程：
1. **search_nearby_orders** - 搜索可用订单
2. **accept_order** - 接受订单
3. **move_to** - 移动到取餐点
4. **pickup_food** - 取餐（必须调用此工具！）
5. **move_to** - 移动到送餐点
6. **deliver_food** - 送餐（必须调用此工具才能获得配送费！）

⚠️ **重要**：移动到送餐点后，**必须调用 deliver_food 工具**才能完成订单并获得配送费。仅仅移动到送餐点是不够的！

## 开始任务
${isLevel01
  ? '请严格按照上述流程调用工具完成配送。记住：到达送餐点后必须调用 deliver_food 工具！'
  : '请开始配送任务，通过调用工具来最大化利润。记住：每个订单都必须调用 deliver_food 才能获得配送费！'
}`;
}

/**
 * 生成 V2 版本的配送流程说明（多模态取餐）
 */
function generateV2WorkflowPrompt(): string {
  return `
## 配送流程（必须严格遵守）
完成一个订单的完整流程：
1. **search_nearby_orders** - 搜索可用订单
2. **accept_order** - 接受订单
3. **move_to** - 移动到取餐点
4. **get_receipts** - 获取小票图片
5. **识别手机号** - 观察小票图片，找到手机号（格式如 172****3882）
6. **pickup_food_by_phone_number** - 使用识别到的手机号取餐
7. **move_to** - 移动到送餐点
8. **deliver_food** - 送餐（必须调用此工具才能获得配送费！）

⚠️ **重要**：
- 取餐时必须先获取小票图片，识别手机号后才能取餐
- 移动到送餐点后，**必须调用 deliver_food 工具**才能完成订单并获得配送费

## 开始任务
请开始配送任务，通过调用工具来最大化利润。记住：
- 每次取餐需要先识别小票上的手机号
- 每个订单都必须调用 deliver_food 才能获得配送费！`;
}

// ============================================================================
// V3 版本提示词（多骑手模式）
// ============================================================================

/**
 * 生成 V3 版本的工具说明（多骑手模式）
 * 所有工具都需要 agent_id 参数
 */
function generateV3ToolsPrompt(riderCount: number): string {
  const agentIds = Array.from({ length: riderCount }, (_, i) => `agent_${i + 1}`).join(', ');
  
  return `
## 可用工具
你需要同时操作 ${riderCount} 个骑手（${agentIds}）来完成配送任务。
**所有工具调用都必须指定 agent_id 参数来指定操作哪个骑手！**
一次对话支持同时调用多个工具，可以对不同骑手发出命令。

### 信息查询类
- **get_my_status(agent_id)**: 查询指定骑手的状态（位置、电量、订单、利润等）
- **get_map(agent_id)**: 获取完整地图信息（位置列表按类型分组 + 邻接表连接关系）
- **search_nearby_orders(agent_id, radius)**: 搜索指定骑手附近的可用订单
- **search_nearby_battery_stations(agent_id, radius)**: 搜索指定骑手附近的换电站
- **get_location_info(agent_id, locationId)**: 获取位置详细信息
- **calculate_distance(agent_id, fromId, toId)**: 计算两点间最短距离
- **estimate_time(agent_id, locationIds)**: 估算路径通行时间（考虑拥堵）
- **help(agent_id)**: 显示此帮助信息

### 行动类
- **accept_order(agent_id, orderId)**: 指定骑手接受订单（每个骑手最多 5 单，总重量不超过 10kg）
- **move_to(agent_id, targetLocationId)**: 指定骑手移动到目标位置
- **get_receipts(agent_id, targetLocationId)**: 获取小票图片（需要识别手机号）
- **pickup_food_by_phone_number(agent_id, phoneNumber)**: 通过手机号取餐
- **deliver_food(agent_id, orderId)**: 送餐（耗时 1 分钟）
- **swap_battery(agent_id)**: 在换电站换电（耗时 1 分钟，花费 0.5 元）
- **wait(agent_id, minutes)**: 等待指定分钟数（1-60）

### ⚠️ 重要：agent_id 参数
- 所有工具调用都必须包含 **agent_id** 参数
- 可用的 agent_id: ${agentIds}
- 你可以在一次响应中同时对多个骑手发出命令

### ⚠️ 重要：取餐流程
取餐需要通过识别小票图片来获取手机号：
1. 到达取餐点后，调用 **get_receipts(agent_id, targetLocationId)** 获取小票图片
2. **注意：餐厅可能同时存在多张小票（包括其他顾客的订单）**，你需要仔细识别每张小票上的菜品信息，找到与你所接订单匹配的小票
3. 在正确的小票上识别手机号（格式如 172****3882）
4. 使用识别到的手机号调用 **pickup_food_by_phone_number(agent_id, phoneNumber)** 完成取餐

### ⚠️ 如何识别正确的小票
- 骑手接单时会获得订单的菜品信息
- 对比小票上的菜品列表与接单时获得的菜品信息
- 找到菜品完全匹配的小票，那就是需要取餐的订单
- 使用该小票上的手机号进行取餐`;
}

/**
 * 生成 V3 版本的规则说明（多骑手模式）
 */
function generateV3RulesPrompt(riderCount: number): string {
  return `
## 重要规则
1. **多骑手协作**：你需要同时操作 ${riderCount} 个骑手，合理分配任务以最大化总利润
2. **共享订单池**：所有骑手共享同一个订单池，一个订单只能被一个骑手接单
3. **利润汇总**：所有骑手的利润会汇总计算，作为最终成绩
4. **独立状态**：每个骑手有独立的位置、电量、携带订单等状态
5. **电量管理**：每个骑手满电续航 50km，电量耗尽后只能推行（10km/h）
6. **承载限制**：每个骑手最多携带 5 单，总重量不超过 10kg
7. **订单类型**：本场景只有外卖订单（0.5-1kg）
8. **超时惩罚**：
   - 准时送达（0 分钟）：无惩罚
   - 超时 0（不含）- 5 分钟：扣除 30% 配送费
   - 超时 5（不含）- 10 分钟：扣除 50% 配送费
   - 超时 10（不含）- 20 分钟：扣除所有配送费（100%）
   - 超时 20 分钟以上：扣除 100% 配送费并在不挣钱基础上追加罚款 10 元
9. **拥堵影响**：道路拥堵会降低速度（30/25/20/15 km/h）`;
}

/**
 * 生成 V3 版本的配送流程说明（多骑手模式）
 */
function generateV3WorkflowPrompt(riderCount: number): string {
  const agentIds = Array.from({ length: riderCount }, (_, i) => `agent_${i + 1}`).join(', ');
  
  return `
## 配送流程（必须严格遵守）
每个骑手完成一个订单的完整流程：
1. **search_nearby_orders(agent_id, radius)** - 搜索可用订单
2. **accept_order(agent_id, orderId)** - 接受订单（订单被接受后其他骑手不可见）
3. **move_to(agent_id, targetLocationId)** - 移动到取餐点
4. **get_receipts(agent_id, targetLocationId)** - 获取小票图片
5. **识别手机号** - 观察小票图片，找到手机号
6. **pickup_food_by_phone_number(agent_id, phoneNumber)** - 使用手机号取餐
7. **move_to(agent_id, targetLocationId)** - 移动到送餐点
8. **deliver_food(agent_id, orderId)** - 送餐

## 多骑手策略建议
- **并行操作**：可以同时对多个骑手发出命令，提高效率
- **区域分工**：可以让不同骑手负责不同区域，减少竞争
- **抢单策略**：热门订单要快速抢单，避免被"其他骑手"抢走
- **路径规划**：为每个骑手规划高效路线，避免空驶
- **电量管理**：关注每个骑手的电量，及时安排换电
- **利润最大化**：在有限时间内完成尽可能多的订单

## 开始任务
你现在控制 ${riderCount} 个骑手（${agentIds}）。
请开始配送任务，通过合理调度所有骑手来最大化总利润。
记住：所有工具调用都必须指定 agent_id 参数！`;
}

/**
 * 生成系统提示词
 * 
 * 这个函数被用于：
 * 1. 初始化对话时的系统消息
 * 2. help 工具调用返回的帮助信息
 * 
 * @param simulator 模拟器实例
 * @param currentIteration 当前对话轮次（可选，用于动态更新）
 * @returns 系统提示词
 */
export function generateSystemPrompt(simulator: Simulator, currentIteration?: number): string {
  const isLevel01 = simulator.isLevel01Mode();
  const isLevel2 = simulator.isLevel2Mode();
  const isLevel3 = simulator.isLevel3Mode();
  const riderCount = simulator.getRiderCount();
  const agentState = simulator.getAgentState();
  const maxIterations = getMaxIterations();
  const toolCallFormat = getToolCallFormat();

  // 根据格式生成对应的 tool call 说明
  let toolCallInstructions = '';
  switch (toolCallFormat) {
    case 'mcp':
      toolCallInstructions = generateMCPToolCallInstructions();
      break;
    case 'sglang':
      toolCallInstructions = generateSGLangToolCallInstructions();
      break;
    case 'openai':
    default:
      toolCallInstructions = generateOpenAIToolCallInstructions();
      break;
  }

  // 根据版本生成不同的工具说明、规则和流程
  let toolsPrompt: string;
  let rulesPrompt: string;
  let workflowPrompt: string;
  
  if (isLevel3) {
    toolsPrompt = generateV3ToolsPrompt(riderCount);
    rulesPrompt = generateV3RulesPrompt(riderCount);
    workflowPrompt = generateV3WorkflowPrompt(riderCount);
  } else if (isLevel2) {
    toolsPrompt = generateV2ToolsPrompt();
    rulesPrompt = generateV2RulesPrompt();
    workflowPrompt = generateV2WorkflowPrompt();
  } else {
    toolsPrompt = generateV1ToolsPrompt();
    rulesPrompt = generateV1RulesPrompt();
    workflowPrompt = generateV1WorkflowPrompt(isLevel01);
  }

  // 策略建议
  const strategyPrompt = isLevel3 
    ? `
## 策略建议
- 你的核心任务是同时调度 ${riderCount} 个骑手，在有限时间内达成最大的总盈利
- 合理分配订单给不同骑手，避免抢单冲突
- 可以让不同骑手负责不同区域，减少路径重叠
- 一次响应中可以同时对多个骑手发出命令，提高效率
- 注意评估每个骑手的电量，及时安排换电
- 在能力范围内让每个骑手多接单，但需要考虑各自的配送上限和重量上限`
    : `
## 策略建议
- 你的核心任务是在有限时间内达成最大的盈利, 因此需要在一次性多接单, 配送费, 重量, 距离, 剩余电量等环境变量之间找到平衡, 并综合考虑
- 合理规划路线，减少空驶, 既可以在送餐的过程中接单或取餐或换电, 也可以在取餐的过程中送餐或接单或换电
- 注意评估电量，及时换电
- 考虑订单时限，避免超时
- 在能力范围内一次性多接单, 但需要考虑配送上限和重量上限`;

  // 确定版本标题
  let versionTitle = '';
  if (isLevel3) {
    versionTitle = ' (V3 多骑手版)';
  } else if (isLevel2) {
    versionTitle = ' (V2 多模态版)';
  }

  // 静态部分 - 放在前面以最大化 KV Cache 复用
  const staticPrompt = `
# Silicon Rider Bench - AI 外卖骑手模拟${versionTitle}

${isLevel3 
  ? `你是一个 AI 调度员，同时操控 ${riderCount} 个外卖骑手在虚拟城市中配送订单以赚取利润。`
  : '你是一个 AI 外卖骑手，在虚拟城市中配送订单以赚取利润。'
}

## 目标
${isLevel01 
  ? '完成单个配送订单，验证基本功能。' 
  : isLevel3
    ? `同时调度 ${riderCount} 个骑手，在有限时间和轮次内最大化总利润。`
    : '在有限时间和轮次内最大化利润。'
}
${toolCallInstructions}
${toolsPrompt}
${rulesPrompt}
${strategyPrompt}
${workflowPrompt}`;

  // Format iteration display (use ∞ for unlimited mode)
  const iterationDisplay = maxIterations === 0 
    ? (currentIteration !== undefined ? `${currentIteration}/∞` : '无限制')
    : (currentIteration !== undefined ? `${currentIteration}/${maxIterations}` : `共 ${maxIterations} 轮`);

  // Format remaining time as "xx小时xx分钟"
  const formatRemainingTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}小时${mins}分钟`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else {
      return `${mins}分钟`;
    }
  };
  const remainingTime = simulator.getGameClock().getRemainingTime();
  const remainingTimeDisplay = formatRemainingTime(remainingTime);

  // 动态部分 - 放在最后以最小化 KV Cache 逐出
  let dynamicPrompt: string;
  
  if (isLevel3) {
    // Level 3: 显示所有骑手的状态
    const allAgentStates = simulator.getAllAgentStates();
    let agentsStatus = '';
    for (const [agentId, state] of allAgentStates) {
      agentsStatus += `
### ${agentId}
- 位置：${state.getPosition()}
- 电量：${state.getBattery()}%（续航 ${state.getBatteryRange().toFixed(1)} km）
- 携带订单：${state.getCarriedOrders().length}/5
- 总重量：${state.getTotalWeight().toFixed(1)}/10 kg
- 利润：¥${state.getProfit().toFixed(2)}
`;
    }
    
    const totalProfit = simulator.getTotalProfit();
    
    dynamicPrompt = `

---
## 当前状态
- 当前时间：${simulator.getFormattedTime()}（剩余 ${remainingTimeDisplay}）
- 对话轮次：${iterationDisplay}
- 总利润：¥${totalProfit.toFixed(2)}

## 各骑手状态
${agentsStatus}`;
  } else if (isLevel01) {
    dynamicPrompt = `

---
## 当前状态
- 位置：${agentState.getPosition()}
- 电量：${agentState.getBattery()}%（续航 ${agentState.getBatteryRange().toFixed(1)} km）
- 携带订单：${agentState.getCarriedOrders().length}/5
- 总重量：${agentState.getTotalWeight().toFixed(1)}/10 kg
- 当前利润：¥${agentState.getProfit().toFixed(2)}`;
  } else {
    dynamicPrompt = `

---
## 当前状态
- 当前时间：${simulator.getFormattedTime()}（剩余 ${remainingTimeDisplay}）
- 对话轮次：${iterationDisplay}
- 位置：${agentState.getPosition()}
- 电量：${agentState.getBattery()}%（续航 ${agentState.getBatteryRange().toFixed(1)} km）
- 携带订单：${agentState.getCarriedOrders().length}/5
- 总重量：${agentState.getTotalWeight().toFixed(1)}/10 kg
- 当前利润：¥${agentState.getProfit().toFixed(2)}`;
  }

  const prompt = (staticPrompt + dynamicPrompt).trim(); 

  return prompt;
}
