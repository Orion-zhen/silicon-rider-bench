# Design Document - Web Visualization

## Overview

本设计文档描述了为 Silicon Rider Bench 添加 Web 可视化界面的技术方案。该功能将在现有终端可视化的基础上，提供一个基于浏览器的实时可视化界面，通过 WebSocket 实现服务器与客户端之间的双向实时通信。

核心设计目标：
- 最小化对现有代码的侵入性修改
- 保持与终端模式的完全兼容性
- 提供流畅的实时更新体验
- 使用轻量级技术栈，避免引入重型框架

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Entry                            │
│                      (src/index.ts)                          │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Terminal Mode│         │  Web Mode    │                 │
│  │   (default)  │         │  (--mode=web)│                 │
│  └──────┬───────┘         └──────┬───────┘                 │
│         │                        │                          │
│         │                        │                          │
│         ▼                        ▼                          │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Terminal     │         │ Web Server   │                 │
│  │ Display      │         │ + WebSocket  │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                   │                          │
│                                   │ HTTP/WS                  │
│                                   ▼                          │
│                            ┌──────────────┐                 │
│                            │   Browser    │                 │
│                            │   Client     │                 │
│                            └──────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Tool Calls
                              ▼
                    ┌──────────────────┐
                    │    Simulator     │
                    │   (unchanged)    │
                    └──────────────────┘
```

### 技术栈选择

**服务器端：**
- Node.js 内置 `http` 模块 - HTTP 服务器
- Node.js 内置 `fs` 模块 - 静态文件服务
- `ws` 库 - WebSocket 服务器（需要添加依赖）

**客户端：**
- 原生 HTML5 + CSS3 - 界面结构和样式
- 原生 JavaScript (ES6+) - 客户端逻辑
- 原生 WebSocket API - 实时通信
- Canvas API - 地图渲染（可选，初期使用 HTML/CSS）

**理由：**
- 避免引入 React/Vue 等重型框架，保持项目轻量
- 使用原生技术降低学习成本和构建复杂度
- WebSocket 提供高效的双向实时通信

## Components and Interfaces

### 1. Web Server Module (`src/web/web-server.ts`)

负责启动 HTTP 服务器和 WebSocket 服务器。

```typescript
interface WebServerConfig {
  host: string;
  port: number;
  staticDir: string;
}

class WebServer {
  constructor(config: WebServerConfig);
  
  // 启动服务器
  start(): Promise<void>;
  
  // 停止服务器
  stop(): Promise<void>;
  
  // 广播消息到所有连接的客户端
  broadcast(message: WebSocketMessage): void;
  
  // 获取连接的客户端数量
  getClientCount(): number;
}
```

### 2. WebSocket Message Protocol

定义服务器与客户端之间的消息格式。

```typescript
// 消息类型
type MessageType = 
  | 'init'           // 初始化数据
  | 'state_update'   // 状态更新
  | 'conversation'   // 对话消息
  | 'tool_call'      // 工具调用
  | 'tool_result'    // 工具结果
  | 'simulation_end' // 模拟结束
  | 'error';         // 错误消息

// 基础消息结构
interface WebSocketMessage {
  type: MessageType;
  timestamp: number;
  data: any;
}

// 初始化消息
interface InitMessage extends WebSocketMessage {
  type: 'init';
  data: {
    nodes: Array<{
      id: string;
      type: NodeType;
      name: string;
      position: { x: number; y: number };
    }>;
    edges: Array<{
      from: string;
      to: string;
      distance: number;
    }>;
    config: {
      level: string;
      seed: number;
      duration: number;
    };
  };
}

// 状态更新消息
interface StateUpdateMessage extends WebSocketMessage {
  type: 'state_update';
  data: {
    currentTime: number;
    formattedTime: string;
    agentState: {
      position: string;
      battery: number;
      profit: number;
      carriedOrders: Array<{
        id: string;
        type: string;
        weight: number;
        deadline: number;
        pickedUp: boolean;
      }>;
      totalWeight: number;
      completedOrders: number;
    };
  };
}

// 对话消息
interface ConversationMessage extends WebSocketMessage {
  type: 'conversation';
  data: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  };
}

// 工具调用消息
interface ToolCallMessage extends WebSocketMessage {
  type: 'tool_call';
  data: {
    toolName: string;
    arguments: Record<string, any>;
  };
}

// 工具结果消息
interface ToolResultMessage extends WebSocketMessage {
  type: 'tool_result';
  data: {
    toolName: string;
    success: boolean;
    result: any;
  };
}
```

### 3. Web Visualization Adapter (`src/web/web-visualization.ts`)

适配器模式，将模拟器事件转换为 WebSocket 消息。

```typescript
class WebVisualization {
  constructor(simulator: Simulator, webServer: WebServer);
  
  // 发送初始化数据
  sendInitialData(): void;
  
  // 发送状态更新
  sendStateUpdate(): void;
  
  // 发送对话消息
  sendConversation(role: string, content: string): void;
  
  // 发送工具调用信息
  sendToolCall(toolName: string, args: any): void;
  
  // 发送工具结果
  sendToolResult(toolName: string, success: boolean, result: any): void;
  
  // 发送模拟结束消息
  sendSimulationEnd(report: string): void;
}
```

### 4. Static Files Structure

```
src/web/public/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式表
└── js/
    ├── main.js         # 主逻辑
    ├── map-renderer.js # 地图渲染
    ├── stats-panel.js  # 统计面板
    └── chat-panel.js   # 对话面板
```

### 5. Client-Side Components

#### MapRenderer
```javascript
class MapRenderer {
  constructor(canvasElement);
  
  // 初始化地图
  initialize(nodes, edges);
  
  // 更新智能体位置
  updateAgentPosition(nodeId);
  
  // 渲染地图
  render();
}
```

#### StatsPanel
```javascript
class StatsPanel {
  constructor(containerElement);
  
  // 更新统计信息
  update(agentState, currentTime);
  
  // 更新订单列表
  updateOrders(carriedOrders);
}
```

#### ChatPanel
```javascript
class ChatPanel {
  constructor(containerElement);
  
  // 添加消息
  addMessage(role, content);
  
  // 添加工具调用
  addToolCall(toolName, args);
  
  // 添加工具结果
  addToolResult(toolName, success, result);
  
  // 自动滚动到底部
  scrollToBottom();
}
```

## Data Models

### Node Display Model

```typescript
interface NodeDisplay {
  id: string;
  type: NodeType;
  emoji: string;  // 对应的 emoji 图标
  x: number;      // 屏幕坐标 x
  y: number;      // 屏幕坐标 y
  name: string;
}

// Emoji 映射
const NODE_EMOJI_MAP: Record<NodeType, string> = {
  restaurant: '🍔',
  supermarket: '🛒',
  pharmacy: '💊',
  residential: '🏠',
  office: '🏢',
  battery_swap: '🔋',
};
```

### Client State Model

```typescript
interface ClientState {
  // 地图数据
  nodes: Map<string, NodeDisplay>;
  edges: Edge[];
  
  // 智能体状态
  agentPosition: string;
  agentState: {
    battery: number;
    profit: number;
    carriedOrders: Order[];
    totalWeight: number;
    completedOrders: number;
  };
  
  // 时间信息
  currentTime: number;
  formattedTime: string;
  
  // 对话历史
  conversations: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;
  
  // 连接状态
  connected: boolean;
}
```

## 
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Host parameter binding
*For any* valid host address string, when passed via --host parameter, the Web server should bind to that specified address
**Validates: Requirements 1.2**

Property 2: Port parameter binding
*For any* valid port number, when passed via --port parameter, the Web server should listen on that specified port
**Validates: Requirements 1.3**

Property 3: Server startup URL output
*For any* successful Web server startup, the CLI should output a URL containing the configured host and port
**Validates: Requirements 1.6**

Property 4: Node emoji mapping
*For any* node type in the system, the rendered HTML should contain the corresponding emoji icon from the NODE_EMOJI_MAP
**Validates: Requirements 2.3**

Property 5: Coordinate transformation consistency
*For any* two nodes with positions (x1, y1) and (x2, y2), if x1 < x2, then the screen coordinate screenX1 < screenX2, and similarly for y coordinates
**Validates: Requirements 2.5**

Property 6: Statistics panel data display
*For any* agent state values (time, battery, profit, orders, weight), the statistics panel HTML should contain string representations of all these values
**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**

Property 7: Order list rendering
*For any* list of carried orders, the statistics panel should display each order's id, type, weight, and deadline
**Validates: Requirements 3.7**

Property 8: Conversation message display
*For any* AI message content, the conversation panel should contain that message text after it is sent
**Validates: Requirements 4.2**

Property 9: Tool call display
*For any* tool call with name and arguments, the conversation panel should display both the tool name and the argument values
**Validates: Requirements 4.3**

Property 10: Tool result display
*For any* tool result data, the conversation panel should contain a representation of that result after it is received
**Validates: Requirements 4.4**

Property 11: WebSocket state update propagation
*For any* simulator state change, a corresponding WebSocket message should be sent to all connected clients
**Validates: Requirements 5.1**

Property 12: Client position update
*For any* position update message received by the client, the agent's displayed position on the map should match the position in the message
**Validates: Requirements 5.2**

Property 13: Client statistics update
*For any* state update message received by the client, the statistics panel should reflect the new values from the message
**Validates: Requirements 5.3**

Property 14: Client conversation update
*For any* conversation message received by the client, that message should appear in the conversation panel
**Validates: Requirements 5.4**

Property 15: 404 error for missing resources
*For any* HTTP request path that does not correspond to an existing file, the server should return a 404 status code
**Validates: Requirements 6.4**

Property 16: MIME type correctness
*For any* static file served, the Content-Type header should match the file extension (.html → text/html, .css → text/css, .js → application/javascript)
**Validates: Requirements 6.5**

Property 17: Terminal logging in Web mode
*For any* significant event (tool call, order completion, error) in Web mode, the terminal should output a log message describing that event
**Validates: Requirements 8.4, 9.3, 9.4, 9.6**

Property 18: Simulator consistency across modes
*For any* simulation with the same seed and configuration, running in terminal mode vs Web mode should produce the same final profit and completed order count
**Validates: Requirements 8.5, 8.6**

## Error Handling

### Server Errors

1. **Port Already in Use**
   - Detection: Catch EADDRINUSE error during server.listen()
   - Response: Log error message with port number, suggest alternative port, exit with code 1

2. **Invalid Host/Port Parameters**
   - Detection: Validate parameters during parsing
   - Response: Log error message, show usage help, exit with code 1

3. **Static File Not Found**
   - Detection: fs.existsSync() check before reading
   - Response: Return 404 status with error page

4. **File Read Errors**
   - Detection: Catch fs.readFile() errors
   - Response: Log error, return 500 status

### WebSocket Errors

1. **Connection Errors**
   - Detection: WebSocket 'error' event
   - Response: Log error, attempt reconnection with exponential backoff

2. **Message Parse Errors**
   - Detection: JSON.parse() try-catch
   - Response: Log warning, ignore malformed message

3. **Client Disconnection**
   - Detection: WebSocket 'close' event
   - Response: Clean up client from connection list, log disconnection

### Client-Side Errors

1. **WebSocket Connection Failure**
   - Detection: WebSocket onerror event
   - Response: Display "Connection Lost" banner, attempt reconnection

2. **Invalid Message Format**
   - Detection: Message validation in client
   - Response: Log warning to console, ignore message

3. **Rendering Errors**
   - Detection: Try-catch around render functions
   - Response: Log error, display error message in affected panel

## Testing Strategy

### Unit Testing

使用 Vitest 进行单元测试，覆盖以下模块：

1. **CLI Parameter Parsing**
   - Test --mode, --host, --port parameter parsing
   - Test default values
   - Test invalid parameter handling

2. **WebSocket Message Serialization**
   - Test message type serialization/deserialization
   - Test data integrity

3. **Coordinate Transformation**
   - Test world coordinates to screen coordinates conversion
   - Test boundary cases

4. **MIME Type Detection**
   - Test file extension to MIME type mapping
   - Test unknown extensions

### Property-Based Testing

使用 fast-check 进行属性测试，每个测试运行 100+ 次：

1. **Property 2: Port parameter binding**
   - Generator: fc.integer({ min: 1024, max: 65535 })
   - Test: Server listens on specified port

2. **Property 5: Coordinate transformation consistency**
   - Generator: fc.record({ x: fc.float(), y: fc.float() })
   - Test: Relative positions preserved

3. **Property 6: Statistics panel data display**
   - Generator: fc.record({ battery: fc.float(0, 100), profit: fc.float(), ... })
   - Test: All values appear in rendered HTML

4. **Property 11: WebSocket state update propagation**
   - Generator: fc.record({ position: fc.string(), battery: fc.float(), ... })
   - Test: State change triggers WebSocket message

5. **Property 18: Simulator consistency across modes**
   - Generator: fc.integer() (seed)
   - Test: Same seed produces same results in both modes

### Integration Testing

1. **End-to-End Web Mode Test**
   - Start server in Web mode
   - Connect WebSocket client
   - Verify initial data received
   - Simulate state changes
   - Verify updates received
   - Verify terminal logs present

2. **Static File Serving Test**
   - Request HTML, CSS, JS files
   - Verify correct content and MIME types
   - Request non-existent file
   - Verify 404 response

3. **Mode Switching Test**
   - Run same simulation in terminal mode
   - Run same simulation in Web mode
   - Compare final statistics

## Implementation Notes

### Performance Considerations

1. **WebSocket Message Throttling**
   - Limit state update frequency to avoid overwhelming clients
   - Batch multiple updates within a time window (e.g., 100ms)

2. **Client-Side Rendering Optimization**
   - Use requestAnimationFrame for smooth updates
   - Only re-render changed elements (dirty checking)

3. **Memory Management**
   - Limit conversation history to last N messages (e.g., 100)
   - Clean up disconnected WebSocket clients

### Security Considerations

1. **Input Validation**
   - Validate host and port parameters
   - Sanitize file paths to prevent directory traversal

2. **CORS**
   - Not needed for same-origin requests
   - Can be added if needed for development

3. **WebSocket Origin Validation**
   - Optional: Validate WebSocket upgrade requests

### Browser Compatibility

Target modern browsers with native WebSocket support:
- Chrome 16+
- Firefox 11+
- Safari 7+
- Edge (all versions)

No polyfills needed for target audience (developers).

## Dependencies

### New Dependencies to Add

```json
{
  "dependencies": {
    "ws": "^8.18.0"  // WebSocket server library
  },
  "devDependencies": {
    "@types/ws": "^8.5.10"  // TypeScript types for ws
  }
}
```

### Rationale

- `ws`: Industry-standard WebSocket library for Node.js, lightweight and well-maintained
- No client-side dependencies needed (using native browser APIs)

## Migration Path

### Phase 1: Core Infrastructure
1. Add CLI parameter parsing for --mode, --host, --port
2. Implement WebServer class with HTTP server
3. Implement WebSocket server
4. Create static file structure (HTML/CSS/JS)

### Phase 2: Server-Side Integration
1. Implement WebVisualization adapter
2. Integrate with Simulator events
3. Add terminal logging for Web mode

### Phase 3: Client-Side Implementation
1. Implement MapRenderer
2. Implement StatsPanel
3. Implement ChatPanel
4. Implement WebSocket client connection

### Phase 4: Testing & Polish
1. Write unit tests
2. Write property-based tests
3. Write integration tests
4. Performance optimization
5. Error handling improvements

## Future Enhancements

Potential improvements for future iterations:

1. **Playback Controls**
   - Pause/resume simulation
   - Speed control (1x, 2x, 5x)
   - Step-by-step execution

2. **Historical Replay**
   - Save simulation events to file
   - Replay past simulations

3. **Multiple Client Support**
   - Broadcast to multiple viewers
   - Collaborative viewing

4. **Enhanced Visualization**
   - Animated agent movement
   - Order pickup/delivery animations
   - Path visualization

5. **Interactive Features**
   - Click nodes for details
   - Hover tooltips
   - Manual order injection (for testing)

6. **Export Features**
   - Export map as image
   - Export conversation log
   - Export statistics as CSV
