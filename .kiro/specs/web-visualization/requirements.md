# Requirements Document

## Introduction

本文档定义了为 Silicon Rider Bench 项目添加 Web 可视化界面的需求。该功能将提供一个基于浏览器的实时可视化界面，用于展示 AI 外卖骑手的配送过程，包括地图渲染、状态监控和 AI 思考过程展示。

## Glossary

- **CLI**: Command Line Interface，命令行界面
- **Web Mode**: Web 模式，通过浏览器访问的可视化模式
- **Simulator**: 模拟器，Silicon Rider Bench 的核心模拟引擎
- **Agent**: 智能体，执行配送任务的 AI 骑手
- **Node**: 节点，地图上的位置点（餐厅、住宅、换电站等）
- **Tool Call**: 工具调用，AI 通过调用工具 API 执行操作
- **WebSocket**: 一种网络通信协议，支持服务器与客户端之间的双向实时通信
- **Emoji Icon**: 表情符号图标，用于在地图上表示不同类型的节点
- **Grid**: 网格，地图的网格背景
- **Statistics Panel**: 统计面板，显示环境状态和骑手信息的区域
- **Conversation Bubble**: 对话气泡，显示 AI 思考过程和工具调用的区域

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望通过命令行参数启动 Web 模式，以便在浏览器中查看模拟过程

#### Acceptance Criteria

1. WHEN 用户执行命令时包含 `--mode=web` 参数 THEN the CLI SHALL 启动 Web 服务器而非终端可视化模式
2. WHEN 用户指定 `--host` 参数 THEN the CLI SHALL 使用指定的主机地址绑定 Web 服务器
3. WHEN 用户指定 `--port` 参数 THEN the CLI SHALL 使用指定的端口号启动 Web 服务器
4. WHEN 用户未指定 `--host` 参数 THEN the CLI SHALL 使用默认值 `localhost` 作为主机地址
5. WHEN 用户未指定 `--port` 参数 THEN the CLI SHALL 使用默认值 `3000` 作为端口号
6. WHEN Web 服务器成功启动 THEN the CLI SHALL 在控制台输出访问 URL

### Requirement 2

**User Story:** 作为用户，我希望在浏览器中看到模拟世界的地图，以便直观了解配送环境

#### Acceptance Criteria

1. WHEN 用户访问 Web 界面 THEN the System SHALL 渲染完整的模拟世界地图
2. WHEN 渲染地图 THEN the System SHALL 显示网格背景以表示空间结构
3. WHEN 渲染节点 THEN the System SHALL 使用 emoji 图标表示不同类型的位置（🍔餐厅、🏠住宅、🏢办公室、🛒超市、💊药店、🔋换电站）
4. WHEN 渲染智能体位置 THEN the System SHALL 使用 🚴 emoji 标记当前骑手位置
5. WHEN 地图节点位置更新 THEN the System SHALL 保持地图比例和布局的一致性

### Requirement 3

**User Story:** 作为用户，我希望在界面右侧看到统计信息，以便了解当前的环境状态和骑手信息

#### Acceptance Criteria

1. WHEN 用户查看 Web 界面 THEN the System SHALL 在右侧显示统计面板
2. WHEN 显示统计面板 THEN the System SHALL 展示当前游戏时间
3. WHEN 显示统计面板 THEN the System SHALL 展示骑手电量百分比
4. WHEN 显示统计面板 THEN the System SHALL 展示当前利润金额
5. WHEN 显示统计面板 THEN the System SHALL 展示携带订单数量和重量信息
6. WHEN 显示统计面板 THEN the System SHALL 展示已完成订单数量
7. WHEN 显示统计面板 THEN the System SHALL 展示骑手背包中的订单详细列表

### Requirement 4

**User Story:** 作为用户，我希望在界面下方看到对话气泡，以便了解 AI 的思考过程和操作

#### Acceptance Criteria

1. WHEN 用户查看 Web 界面 THEN the System SHALL 在下方显示对话气泡区域
2. WHEN AI 生成思考内容 THEN the System SHALL 在对话气泡中显示 AI 的推理文本
3. WHEN AI 调用工具 THEN the System SHALL 在对话气泡中显示工具名称和参数
4. WHEN 工具调用返回结果 THEN the System SHALL 在对话气泡中显示返回的数据
5. WHEN 新的对话内容产生 THEN the System SHALL 自动滚动到最新消息

### Requirement 5

**User Story:** 作为用户，我希望界面能够实时更新，以便跟踪模拟的最新状态

#### Acceptance Criteria

1. WHEN 模拟器状态发生变化 THEN the System SHALL 通过 WebSocket 推送更新到客户端
2. WHEN 客户端接收到状态更新 THEN the System SHALL 立即更新地图上的骑手位置
3. WHEN 客户端接收到状态更新 THEN the System SHALL 立即更新统计面板中的数据
4. WHEN 客户端接收到新的对话消息 THEN the System SHALL 立即在对话气泡区域显示
5. WHEN WebSocket 连接断开 THEN the System SHALL 在界面上显示连接状态提示

### Requirement 6

**User Story:** 作为开发者，我希望 Web 服务器能够正确处理静态资源，以便界面正常显示

#### Acceptance Criteria

1. WHEN 客户端请求 HTML 页面 THEN the Web Server SHALL 返回主页面文件
2. WHEN 客户端请求 CSS 文件 THEN the Web Server SHALL 返回样式表文件
3. WHEN 客户端请求 JavaScript 文件 THEN the Web Server SHALL 返回脚本文件
4. WHEN 请求的资源不存在 THEN the Web Server SHALL 返回 404 错误
5. WHEN 服务器启动 THEN the Web Server SHALL 正确设置静态资源的 MIME 类型

### Requirement 7

**User Story:** 作为用户，我希望界面布局清晰合理，以便同时查看地图、统计和对话信息

#### Acceptance Criteria

1. WHEN 用户访问 Web 界面 THEN the System SHALL 使用响应式布局适配不同屏幕尺寸
2. WHEN 显示界面 THEN the System SHALL 将地图区域放置在左侧或中央主要位置
3. WHEN 显示界面 THEN the System SHALL 将统计面板放置在右侧固定位置
4. WHEN 显示界面 THEN the System SHALL 将对话气泡区域放置在底部固定位置
5. WHEN 内容超出区域范围 THEN the System SHALL 提供滚动功能

### Requirement 8

**User Story:** 作为开发者，我希望 Web 模式与现有终端模式互不干扰，以便保持向后兼容性

#### Acceptance Criteria

1. WHEN 用户未指定 `--mode` 参数 THEN the CLI SHALL 使用默认的终端可视化模式
2. WHEN 用户指定 `--mode=terminal` THEN the CLI SHALL 使用终端可视化模式
3. WHEN 用户指定 `--mode=web` THEN the CLI SHALL 启动 Web 服务器并保持终端日志输出
4. WHEN Web 模式运行 THEN the CLI SHALL 在终端输出关键事件和状态信息
5. WHEN Web 模式运行 THEN the Simulator SHALL 保持与终端模式相同的核心逻辑
6. WHEN 切换可视化模式 THEN the System SHALL 不影响模拟器的评分和统计功能

### Requirement 9

**User Story:** 作为开发者，我希望在 Web 模式下终端仍然输出日志，以便监控和调试

#### Acceptance Criteria

1. WHEN Web 模式启动 THEN the CLI SHALL 在终端输出服务器启动信息和访问 URL
2. WHEN 模拟器初始化 THEN the CLI SHALL 在终端输出初始化进度信息
3. WHEN AI 执行工具调用 THEN the CLI SHALL 在终端输出工具调用的名称和结果
4. WHEN 订单完成 THEN the CLI SHALL 在终端输出订单完成信息和收益
5. WHEN 模拟结束 THEN the CLI SHALL 在终端输出最终评分报告
6. WHEN 发生错误 THEN the CLI SHALL 在终端输出错误信息和堆栈跟踪
