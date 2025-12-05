/**
 * 核心数据类型定义
 * Silicon Rider Bench - Agent 基准测试系统
 */

// ============================================================================
// 地图相关类型
// ============================================================================

/**
 * 节点类型
 */
export type NodeType = 
  | 'restaurant'      // 餐厅
  | 'supermarket'     // 超市
  | 'pharmacy'        // 药店
  | 'residential'     // 居民区
  | 'office'          // 写字楼
  | 'battery_swap';   // 换电站

/**
 * 节点（地图上的位置）
 */
export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  name: string;
  emoji?: string; // 可选的 emoji 图标
}

/**
 * 边（连接两个节点的道路）
 */
export interface Edge {
  from: string;           // Node ID
  to: string;             // Node ID
  distance: number;       // km
  baseCongestion: number; // 0-1
}

/**
 * 拥堵程度
 */
export type CongestionLevel = 'normal' | 'light' | 'moderate' | 'heavy';

// ============================================================================
// 订单相关类型
// ============================================================================

/**
 * 订单类型
 */
export type OrderType = 'food' | 'supermarket' | 'pharmacy';

/**
 * 订单
 */
export interface Order {
  id: string;
  type: OrderType;
  name: string;              // 订单名称（食物/商品名称）
  pickupLocation: string;    // Node ID
  deliveryLocation: string;  // Node ID
  distance: number;          // km
  itemPrice: number;         // 元
  deliveryFee: number;       // 元（总配送费）
  weight: number;            // kg
  timeLimit: number;         // 分钟
  createdAt: number;         // 订单创建时间（游戏时间，分钟）
  acceptedAt?: number;       // 游戏时间（分钟）
  deadline?: number;         // 游戏时间（分钟）
  pickedUp: boolean;
  delivered: boolean;
  // V2 multimodal fields
  phoneNumber?: string;      // 手机号（V2 模式使用）
  receiptImagePath?: string; // 小票图片路径（V2 模式使用）
  foodItems?: Array<{        // 菜品列表（V2 模式使用）
    name: string;
    price: number;
  }>;
}

// ============================================================================
// 智能体相关类型
// ============================================================================

/**
 * 智能体状态
 */
export interface AgentState {
  position: string;          // Node ID
  battery: number;           // 0-100%
  carriedOrders: Order[];
  totalWeight: number;       // kg
  profit: number;            // 元
  completedOrders: number;
  totalDistance: number;     // km
}

// ============================================================================
// 世界状态类型
// ============================================================================

/**
 * 世界状态
 */
export interface WorldState {
  nodes: Map<string, Node>;
  edges: Edge[];
  currentTime: number;                    // 游戏时间（分钟，0-1440）
  seed: number;
  congestionMap: Map<string, number>;     // Edge ID -> congestion level
}

// ============================================================================
// 工具调用相关类型
// ============================================================================

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  toolName: string;
  parameters: Record<string, any>;
}

/**
 * 工具调用成功响应
 */
export interface ToolCallSuccess<T = any> {
  success: true;
  data: T;
}

/**
 * 工具调用错误响应
 */
export interface ToolCallError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
}

/**
 * 工具调用响应（成功或失败）
 */
export type ToolCallResponse<T = any> = ToolCallSuccess<T> | ToolCallError;

// ============================================================================
// 错误类型
// ============================================================================

/**
 * 错误代码
 */
export type ErrorCode =
  | 'INVALID_PARAMETER'      // 参数无效或缺失
  | 'INVALID_LOCATION'       // 位置 ID 不存在
  | 'INVALID_ORDER'          // 订单 ID 不存在或无效
  | 'CAPACITY_EXCEEDED'      // 超过订单数量限制（5单）
  | 'WEIGHT_EXCEEDED'        // 超过重量限制（10kg）
  | 'WRONG_LOCATION'         // 不在正确位置执行操作
  | 'ORDER_NOT_CARRIED'      // 订单不在携带列表中
  | 'ORDER_NOT_PICKED_UP'    // 订单未取餐
  | 'BATTERY_DEPLETED'       // 电量耗尽无法移动
  | 'NOT_AT_SWAP_STATION'    // 不在换电站
  | 'PHONE_NUMBER_NOT_MATCH' // 手机号不匹配（V2 模式）
  | 'NO_RECEIPTS_AT_LOCATION'; // 当前位置没有待取餐的小票（V2 模式）

// ============================================================================
// 工具 API 响应类型
// ============================================================================

/**
 * get_my_status 响应
 */
export interface GetMyStatusResponse {
  position: string;
  battery: number;
  batteryRange: number;  // 剩余续航 km
  acceptedOrders: Array<{
    id: string;
    type: string;
    name: string;
    weight: number;
    deadline: number;
    pickupLocation: string;
    deliveryLocation: string;
  }>;
  carriedOrders: Array<{
    id: string;
    type: string;
    name: string;
    weight: number;
    deadline: number;
    pickupLocation: string;
    deliveryLocation: string;
  }>;
  totalWeight: number;
  remainingCapacity: number;  // 10 - totalWeight
  currentTime: number;        // 当前时间（分钟）
  formattedTime: string;      // 格式化的当前时间 HH:mm
  remainingTime: number;      // 剩余时间（分钟）
  formattedRemainingTime: string;  // 格式化的剩余时间 "xx小时xx分钟"
  profit: number;
}

/**
 * search_nearby_orders 响应
 */
export interface SearchNearbyOrdersResponse {
  orders: Array<{
    id: string;
    type: OrderType;
    name: string;
    deliveryFee: number;
    weight: number;
    itemPrice: number;
    pickupLocation: string;
    deliveryLocation: string;
    distance: number;
    estimatedTimeLimit: number;
  }>;
}

/**
 * search_nearby_battery_stations 响应
 */
export interface SearchNearbyBatteryStationsResponse {
  stations: Array<{
    id: string;
    name: string;
    distance: number;  // km
    estimatedTime: number;  // 分钟
    position: { x: number; y: number };
  }>;
}

/**
 * get_location_info 响应
 */
export interface GetLocationInfoResponse {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  /** 相邻的位置列表 */
  neighbors: Array<{
    id: string;       // 邻居节点 ID
    name: string;     // 邻居节点名称
    type: string;     // 邻居节点类型
    distance: string; // 距离（如 "1.5km"）
  }>;
}

/**
 * calculate_distance 响应
 */
export interface CalculateDistanceResponse {
  distance: number;  // km
  path: string[];    // Node IDs
}

/**
 * estimate_time 响应
 */
export interface EstimateTimeResponse {
  totalTime: number;  // 分钟
  segments: Array<{
    from: string;
    to: string;
    distance: number;
    congestion: string;
    speed: number;
    time: number;
    path: string[];  // 详细路径节点列表
  }>;
}

/**
 * get_map 响应
 * 返回完整地图信息，按类型分组 + 邻接表格式
 */
export interface GetMapResponse {
  /** 按类型分组的位置列表 */
  locationsByType: {
    restaurant: string[];      // 格式: "node_id(名称)"
    supermarket: string[];
    pharmacy: string[];
    residential: string[];
    office: string[];
    battery_swap: string[];
  };
  /** 邻接表：每个位置可以直接到达的相邻位置 */
  connections: Record<string, Array<{
    to: string;       // 目标节点 ID
    name: string;     // 目标节点名称
    type: string;     // 目标节点类型
    distance: string; // 距离（如 "1.5km"）
  }>>;
}

/**
 * accept_order 响应
 */
export interface AcceptOrderResponse {
  success: boolean;
  message?: string;
  order?: Order;
}

/**
 * move_to 响应
 */
export interface MoveToResponse {
  success: boolean;
  timeCost: number;       // 分钟
  batteryCost: number;    // %
  newPosition: string;
  distance?: number;      // 移动距离（km）
  pushedDistance?: number; // 如果途中没电，推行的距离
}

/**
 * pickup_food 响应
 */
export interface PickupFoodResponse {
  success: boolean;
  timeCost: number;  // 固定 2 分钟
  message?: string;
}

/**
 * deliver_food 响应
 */
export interface DeliverFoodResponse {
  success: boolean;
  payment: number;    // 实际支付金额（扣除惩罚后）
  overtime: number;   // 超时分钟数
  penalty: number;    // 惩罚金额
  timeCost: number;   // 固定 1 分钟
}

/**
 * swap_battery 响应
 */
export interface SwapBatteryResponse {
  success: boolean;
  cost: number;       // 0.5 元
  timeCost: number;   // 1 分钟
  newBattery: number; // 100%
}

/**
 * get_receipts 响应（V2 模式）
 */
export interface GetReceiptsResponse {
  receipts: Array<{
    orderId: string;
    imagePath: string;
    imageData?: string;  // base64 encoded image or file:// URL
  }>;
  message?: string;
}

/**
 * pickup_food_by_phone_number 响应（V2 模式）
 */
export interface PickupFoodByPhoneResponse {
  success: boolean;
  timeCost: number;  // 固定 2 分钟
  orderId?: string;  // 匹配到的订单 ID
  message?: string;
}

/**
 * wait 响应
 */
export interface WaitResponse {
  success: boolean;
  timeCost: number;       // 等待的分钟数
  previousTime: number;   // 等待前的时间
  currentTime: number;    // 等待后的时间
  newOrdersGenerated: number;  // 新生成的订单数量
  expiredOrders: number;  // 过期移除的订单数量
  message?: string;
}

// ============================================================================
// 辅助类型
// ============================================================================

/**
 * 移动结果
 */
export interface MoveResult {
  time: number;           // 分钟
  batteryCost: number;    // %
  pushedDistance: number; // km
}

/**
 * 支付结果
 */
export interface Payment {
  payment: number;  // 实际支付金额
  penalty: number;  // 惩罚金额
  overtime: number; // 超时分钟数
}

/**
 * Level 配置
 */
export interface LevelConfig {
  duration: number;           // 模拟时长（分钟）
  mapSize: 'small' | 'large';
  seed: number;
  orderCount?: number;        // Level 0.1 使用
  baseOrderFrequency?: number; // Level 1 使用（分钟）
  useRealReceiptData?: boolean; // Level 2 使用：是否使用真实小票数据
  excludeNodeTypes?: NodeType[]; // 排除的节点类型（V2 模式下排除超市和药店）
}

// ============================================================================
// V2 小票数据类型
// ============================================================================

/**
 * 小票中的食品项
 */
export interface ReceiptFoodItem {
  name: string;
  price: number;
}

/**
 * 单条小票数据
 */
export interface ReceiptData {
  order_id: string;
  image_filename: string;
  phone_number: string;
  food_items: ReceiptFoodItem[];
  total_price: number;
}

/**
 * 小票数据集
 */
export interface ReceiptDataset {
  metadata: {
    version: string;
    created_at: string;
    total_orders: number;
    source: string;
  };
  orders: ReceiptData[];
}

/**
 * 图片传输模式
 */
export type ImageTransportMode = 'base64' | 'file_path';

// ============================================================================
// 多代理配置类型
// ============================================================================

/**
 * 单个代理配置
 */
export interface AgentConfig {
  id: string;           // 代理唯一标识符（格式: {modelShortName}-{index}）
  modelName: string;    // AI 模型名称（如 "openai/gpt-4"）
  baseURL?: string;     // 自定义 API 基础 URL（可选）
  apiKey?: string;      // 自定义 API 密钥（可选，用于支持多个提供商）
}

/**
 * 多代理运行时状态
 */
export interface AgentRuntimeState {
  id: string;           // 代理 ID
  modelName: string;    // 模型名称
  position: string;     // 当前位置
  battery: number;      // 电量
  profit: number;       // 利润
  carriedOrders: Order[]; // 携带的订单
  status: 'idle' | 'thinking' | 'executing' | 'error'; // 运行状态
  lastAction?: string;  // 最后的操作
  lastActionTime?: number; // 最后操作时间
}
