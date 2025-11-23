# Implementation Plan

- [x] 1. 添加项目依赖和配置
  - 安装 ws 和 @types/ws 依赖包
  - 更新 package.json
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2. 实现 CLI 参数解析扩展
  - 在 src/index.ts 中添加 --mode, --host, --port 参数解析
  - 实现参数验证逻辑
  - 设置默认值（mode=terminal, host=localhost, port=3000）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2_

- [x] 2.1 编写 CLI 参数解析的单元测试
  - 测试 --mode 参数解析
  - 测试 --host 和 --port 参数解析
  - 测试默认值行为
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.2 编写属性测试：端口参数绑定
  - **Property 2: Port parameter binding**
  - **Validates: Requirements 1.3**

- [x] 3. 创建 WebSocket 消息协议类型定义
  - 创建 src/web/types.ts
  - 定义 MessageType 枚举
  - 定义各种消息接口（InitMessage, StateUpdateMessage, ConversationMessage 等）
  - _Requirements: 5.1_

- [x] 4. 实现 Web 服务器核心模块
  - 创建 src/web/web-server.ts
  - 实现 WebServer 类
  - 实现 HTTP 服务器启动和静态文件服务
  - 实现 WebSocket 服务器集成
  - 实现客户端连接管理
  - 实现消息广播功能
  - _Requirements: 1.1, 1.6, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4.1 编写 Web 服务器单元测试
  - 测试服务器启动和停止
  - 测试静态文件服务
  - 测试 404 错误处理
  - 测试 MIME 类型设置
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4.2 编写属性测试：404 错误处理
  - **Property 15: 404 error for missing resources**
  - **Validates: Requirements 6.4**

- [x] 4.3 编写属性测试：MIME 类型正确性
  - **Property 16: MIME type correctness**
  - **Validates: Requirements 6.5**

- [x] 5. 实现 Web 可视化适配器
  - 创建 src/web/web-visualization.ts
  - 实现 WebVisualization 类
  - 实现 sendInitialData() 方法
  - 实现 sendStateUpdate() 方法
  - 实现 sendConversation() 方法
  - 实现 sendToolCall() 和 sendToolResult() 方法
  - 实现 sendSimulationEnd() 方法
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 5.1 编写属性测试：WebSocket 状态更新传播
  - **Property 11: WebSocket state update propagation**
  - **Validates: Requirements 5.1**

- [x] 6. 创建静态文件目录结构
  - 创建 src/web/public/ 目录
  - 创建 src/web/public/css/ 目录
  - 创建 src/web/public/js/ 目录
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 7. 实现 HTML 主页面
  - 创建 src/web/public/index.html
  - 实现页面基础结构（header, main, aside, footer）
  - 添加地图容器元素
  - 添加统计面板容器元素
  - 添加对话面板容器元素
  - 添加连接状态指示器
  - _Requirements: 2.1, 3.1, 4.1, 5.5, 7.2, 7.3, 7.4_

- [x] 8. 实现 CSS 样式表
  - 创建 src/web/public/css/style.css
  - 实现响应式布局样式
  - 实现地图区域样式（网格背景）
  - 实现统计面板样式
  - 实现对话面板样式
  - 实现滚动条样式
  - 实现连接状态指示器样式
  - _Requirements: 2.2, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. 实现客户端主逻辑
  - 创建 src/web/public/js/main.js
  - 实现 WebSocket 连接管理
  - 实现消息路由和处理
  - 实现连接状态管理
  - 实现自动重连逻辑
  - _Requirements: 5.1, 5.5_

- [x] 10. 实现地图渲染器
  - 创建 src/web/public/js/map-renderer.js
  - 实现 MapRenderer 类
  - 实现 initialize() 方法（初始化地图数据）
  - 实现 updateAgentPosition() 方法
  - 实现 render() 方法（渲染节点和智能体）
  - 实现坐标转换逻辑
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.2_

- [x] 10.1 编写属性测试：节点 emoji 映射
  - **Property 4: Node emoji mapping**
  - **Validates: Requirements 2.3**

- [x] 10.2 编写属性测试：坐标转换一致性
  - **Property 5: Coordinate transformation consistency**
  - **Validates: Requirements 2.5**

- [x] 10.3 编写属性测试：客户端位置更新
  - **Property 12: Client position update**
  - **Validates: Requirements 5.2**

- [x] 11. 实现统计面板
  - 创建 src/web/public/js/stats-panel.js
  - 实现 StatsPanel 类
  - 实现 update() 方法（更新统计信息）
  - 实现 updateOrders() 方法（更新订单列表）
  - 实现数据格式化辅助函数
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.3_

- [x] 11.1 编写属性测试：统计面板数据显示
  - **Property 6: Statistics panel data display**
  - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6**

- [x] 11.2 编写属性测试：订单列表渲染
  - **Property 7: Order list rendering**
  - **Validates: Requirements 3.7**

- [x] 11.3 编写属性测试：客户端统计更新
  - **Property 13: Client statistics update**
  - **Validates: Requirements 5.3**

- [x] 12. 实现对话面板
  - 创建 src/web/public/js/chat-panel.js
  - 实现 ChatPanel 类
  - 实现 addMessage() 方法
  - 实现 addToolCall() 方法
  - 实现 addToolResult() 方法
  - 实现 scrollToBottom() 方法
  - 实现消息格式化和高亮
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.4_

- [x] 12.1 编写属性测试：对话消息显示
  - **Property 8: Conversation message display**
  - **Validates: Requirements 4.2**

- [x] 12.2 编写属性测试：工具调用显示
  - **Property 9: Tool call display**
  - **Validates: Requirements 4.3**

- [x] 12.3 编写属性测试：工具结果显示
  - **Property 10: Tool result display**
  - **Validates: Requirements 4.4**

- [x] 12.4 编写属性测试：客户端对话更新
  - **Property 14: Client conversation update**
  - **Validates: Requirements 5.4**

- [x] 13. 集成 Web 模式到主程序入口
  - 修改 src/index.ts
  - 根据 --mode 参数选择可视化方式
  - 在 Web 模式下启动 Web 服务器
  - 在 Web 模式下创建 WebVisualization 适配器
  - 保持终端日志输出
  - 输出服务器访问 URL
  - _Requirements: 1.1, 1.6, 8.3, 8.4, 9.1_

- [x] 14. 实现 Web 模式下的终端日志
  - 在 Web 模式下保持关键事件的终端输出
  - 输出服务器启动信息
  - 输出模拟器初始化信息
  - 输出工具调用信息
  - 输出订单完成信息
  - 输出最终评分报告
  - 输出错误信息
  - _Requirements: 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 14.1 编写属性测试：终端日志输出
  - **Property 17: Terminal logging in Web mode**
  - **Validates: Requirements 8.4, 9.3, 9.4, 9.6**

- [x] 15. 修改 AI 客户端以支持 Web 可视化
  - 修改 src/client/ai-client.ts
  - 添加可选的 WebVisualization 参数
  - 在对话循环中调用 WebVisualization 方法
  - 发送对话消息到 Web 客户端
  - 发送工具调用信息到 Web 客户端
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 16. 实现错误处理和边界情况
  - 处理端口已占用错误
  - 处理无效参数错误
  - 处理静态文件读取错误
  - 处理 WebSocket 连接错误
  - 处理客户端断开连接
  - 实现客户端重连逻辑
  - _Requirements: 5.5_

- [x] 17. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [x] 18. 编写集成测试
  - 测试完整的 Web 模式启动流程
  - 测试 WebSocket 连接和消息传递
  - 测试静态文件服务
  - 测试模式切换不影响模拟结果
  - _Requirements: 所有需求_

- [x] 18.1 编写属性测试：模拟器跨模式一致性
  - **Property 18: Simulator consistency across modes**
  - **Validates: Requirements 8.5, 8.6**

- [x] 19. 性能优化
  - 实现 WebSocket 消息节流
  - 实现客户端渲染优化
  - 限制对话历史记录数量
  - 清理断开的 WebSocket 连接
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 20. 更新项目文档
  - 更新 README.md，添加 Web 模式使用说明
  - 添加 Web 模式的命令行选项说明
  - 添加 Web 界面的截图或描述
  - 更新配置说明
  - _Requirements: 所有需求_

- [x] 21. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
