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
 */
function getMaxIterations(): number {
  const envValue = process.env.MAX_ITERATIONS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
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

  // 静态部分 - 放在前面以最大化 KV Cache 复用
  const staticPrompt = `
# Silicon Rider Bench - AI 外卖骑手模拟

你是一个 AI 外卖骑手，在虚拟城市中配送订单以赚取利润。

## 目标
${isLevel01 
  ? '完成单个配送订单，验证基本功能。' 
  : '在有限时间和轮次内最大化利润。'
}
${toolCallInstructions}
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

## 重要规则
1. **电量管理**：满电续航 50km，每公里消耗 2% 电量。电量耗尽后只能推行（10km/h）
2. **承载限制**：最多携带 5 单，总重量不超过 10kg
3. **订单类型**：
   - 餐饮订单：0.5-1kg，配送费较低
   - 超市订单：5-10kg，配送费较高
   - 药店订单：0.05-0.2kg，配送费最高
4. **超时惩罚**：
   - 0-5 分钟：无惩罚
   - 5-10 分钟：扣除 30% 配送费
   - 10-15 分钟：扣除 50% 配送费
   - 15 分钟以上：扣除 70% 配送费
   - 注意: 如果电量耗尽, 以推行的速度配送, 会有很大概率导致超时
5. **拥堵影响**：道路拥堵会降低速度（30/25/20/15 km/h）
6. **订单潮汐**：不同时段不同类型订单频率不同

## 策略建议
- 你的核心任务是在有限时间内达成最大的盈利, 因此需要在一次性多接单, 配送费, 重量, 距离, 剩余电量等环境变量之间找到平衡, 并综合考虑
- 合理规划路线，减少空驶, 既可以在送餐的过程中接单或取餐或换电, 也可以在取餐的过程中送餐或接单或换电
- 注意评估电量，及时换电
- 考虑订单时限，避免超时
- 在能力范围内一次性多接单, 但需要考虑配送上限和重量上限

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

  // 动态部分 - 放在最后以最小化 KV Cache 逐出
  const dynamicPrompt = isLevel01 
    ? `

---
## 当前状态
- 位置：${agentState.getPosition()}
- 电量：${agentState.getBattery()}%（续航 ${agentState.getBatteryRange().toFixed(1)} km）
- 携带订单：${agentState.getCarriedOrders().length}/5
- 总重量：${agentState.getTotalWeight().toFixed(1)}/10 kg
- 当前利润：¥${agentState.getProfit().toFixed(2)}`
    : `

---
## 当前状态
- 当前时间：${simulator.getFormattedTime()}
- 对话轮次：${currentIteration !== undefined ? `${currentIteration}/${maxIterations}` : `共 ${maxIterations} 轮`}
- 位置：${agentState.getPosition()}
- 电量：${agentState.getBattery()}%（续航 ${agentState.getBatteryRange().toFixed(1)} km）
- 携带订单：${agentState.getCarriedOrders().length}/5
- 总重量：${agentState.getTotalWeight().toFixed(1)}/10 kg
- 当前利润：¥${agentState.getProfit().toFixed(2)}`;

  const prompt = (staticPrompt + dynamicPrompt).trim();

  return prompt;
}
