/**
 * 终端可视化模块
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 需求：15.1-15.5
 * 实现实时终端显示，包括地图渲染、状态信息和实时更新
 */

import { NodeType } from '../types';
import { Simulator } from '../core/simulator';
import { GameClock } from '../core/game-clock';

/**
 * 节点类型到显示符号的映射
 */
const NODE_SYMBOLS: Record<NodeType, string> = {
  restaurant: '🍔',
  supermarket: '🛒',
  pharmacy: '💊',
  residential: '🏠',
  office: '🏢',
  battery_swap: '🔋',
};

/**
 * 终端显示配置
 */
interface DisplayConfig {
  mapWidth: number;
  mapHeight: number;
  showGrid: boolean;
  updateInterval: number; // ms
}

/**
 * 终端显示类
 * 
 * 负责：
 * - 渲染地图（使用 ASCII 字符）
 * - 显示智能体状态信息
 * - 实时更新显示
 */
export class TerminalDisplay {
  private simulator: Simulator;
  private config: DisplayConfig;
  private lastUpdateTime: number = 0;

  /**
   * 创建终端显示实例
   * 
   * @param simulator 模拟器实例
   * @param config 显示配置
   */
  constructor(simulator: Simulator, config?: Partial<DisplayConfig>) {
    this.simulator = simulator;
    this.config = {
      mapWidth: 60,
      mapHeight: 20,
      showGrid: true,
      updateInterval: 100,
      ...config,
    };
  }

  /**
   * 渲染完整显示
   * 需求：15.1-15.5
   * 
   * @returns 渲染后的字符串
   */
  render(): string {
    const lines: string[] = [];

    // 顶部边框和标题
    lines.push(this.renderTopBorder());
    lines.push(this.renderHeader());
    lines.push(this.renderStatusLine());
    lines.push(this.renderSeparator());

    // 地图区域
    const mapLines = this.renderMap();
    lines.push(...mapLines);

    // 底部边框和图例
    lines.push(this.renderSeparator());
    lines.push(this.renderLegend());
    lines.push(this.renderBottomBorder());

    return lines.join('\n');
  }

  /**
   * 渲染顶部边框
   */
  private renderTopBorder(): string {
    return '╔' + '═'.repeat(this.config.mapWidth + 2) + '╗';
  }

  /**
   * 渲染底部边框
   */
  private renderBottomBorder(): string {
    return '╚' + '═'.repeat(this.config.mapWidth + 2) + '╝';
  }

  /**
   * 渲染分隔线
   */
  private renderSeparator(): string {
    return '╠' + '═'.repeat(this.config.mapWidth + 2) + '╣';
  }

  /**
   * 渲染标题行
   * 需求：15.1
   */
  private renderHeader(): string {
    // const config = this.simulator.getConfig();
    const level = this.simulator.isLevel01Mode() ? '0.1' : '1';
    const title = `Silicon Rider Bench - Level ${level}`;
    const padding = Math.max(0, this.config.mapWidth - title.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    
    return '║ ' + ' '.repeat(leftPad) + title + ' '.repeat(rightPad) + ' ║';
  }

  /**
   * 渲染状态行
   * 需求：15.2, 15.3, 15.4
   */
  private renderStatusLine(): string {
    const agentState = this.simulator.getAgentState();
    const currentTime = this.simulator.getCurrentTime();
    const formattedTime = GameClock.formatTime(currentTime);
    
    const battery = agentState.getBattery().toFixed(0);
    const profit = agentState.getProfit().toFixed(2);
    const completed = agentState.getCompletedOrders();
    const carried = agentState.getCarriedOrders().length;
    const maxOrders = 5;
    const weight = agentState.getTotalWeight().toFixed(1);
    const maxWeight = 10;

    const statusText = `Time: ${formattedTime} | Battery: ${battery}% | Profit: ¥${profit} | Orders: ${carried}/${maxOrders} (${weight}/${maxWeight}kg) | Completed: ${completed}`;
    
    const padding = Math.max(0, this.config.mapWidth - statusText.length);
    return '║ ' + statusText + ' '.repeat(padding) + ' ║';
  }

  /**
   * 渲染地图
   * 需求：15.1
   * 
   * @returns 地图行数组
   */
  private renderMap(): string[] {
    const lines: string[] = [];
    const nodes = this.simulator.getNodes();
    const agentState = this.simulator.getAgentState();
    const agentPosition = agentState.getPosition();

    // 计算节点位置的边界
    const positions = Array.from(nodes.values()).map(n => n.position);
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));

    // 创建地图网格
    const grid: string[][] = [];
    for (let y = 0; y < this.config.mapHeight; y++) {
      grid[y] = [];
      for (let x = 0; x < this.config.mapWidth; x++) {
        grid[y][x] = ' ';
      }
    }

    // 将节点映射到网格
    for (const node of nodes.values()) {
      const gridX = Math.floor(
        ((node.position.x - minX) / (maxX - minX)) * (this.config.mapWidth - 1)
      );
      const gridY = Math.floor(
        ((node.position.y - minY) / (maxY - minY)) * (this.config.mapHeight - 1)
      );

      if (gridX >= 0 && gridX < this.config.mapWidth && gridY >= 0 && gridY < this.config.mapHeight) {
        // 如果是智能体当前位置，显示智能体符号
        if (node.id === agentPosition) {
          grid[gridY][gridX] = '🚴';
        } else {
          grid[gridY][gridX] = NODE_SYMBOLS[node.type];
        }
      }
    }

    // 将网格转换为字符串行
    for (let y = 0; y < this.config.mapHeight; y++) {
      const line = grid[y].join('');
      const padding = Math.max(0, this.config.mapWidth - this.getDisplayWidth(line));
      lines.push('║ ' + line + ' '.repeat(padding) + ' ║');
    }

    return lines;
  }

  /**
   * 计算字符串的显示宽度（考虑 emoji 占用 2 个字符宽度）
   */
  private getDisplayWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      // 简单判断：emoji 和中文字符占 2 个宽度
      if (char.match(/[\u{1F300}-\u{1F9FF}]/u) || char.charCodeAt(0) > 127) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  /**
   * 渲染图例
   * 需求：15.1
   */
  private renderLegend(): string {
    const legend = '🏠=Residential 🏢=Office 🍔=Restaurant 🛒=Supermarket 💊=Pharmacy 🔋=Swap 🚴=Agent';
    const padding = Math.max(0, this.config.mapWidth - this.getDisplayWidth(legend));
    return '║ ' + legend + ' '.repeat(padding) + ' ║';
  }

  /**
   * 清空终端屏幕
   */
  clearScreen(): void {
    // ANSI 转义序列：清空屏幕并移动光标到左上角
    process.stdout.write('\x1b[2J\x1b[H');
  }

  /**
   * 显示到终端
   * 需求：15.5
   */
  display(): void {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.config.updateInterval) {
      return; // 限制更新频率
    }

    this.clearScreen();
    console.log(this.render());
    this.lastUpdateTime = now;
  }

  /**
   * 渲染详细订单信息（可选）
   */
  renderOrderDetails(): string {
    const lines: string[] = [];
    const agentState = this.simulator.getAgentState();
    const carriedOrders = agentState.getCarriedOrders();
    const availableOrders = this.simulator.getAvailableOrders();

    lines.push('\n=== 携带订单 ===');
    if (carriedOrders.length === 0) {
      lines.push('无');
    } else {
      for (const order of carriedOrders) {
        const status = order.pickedUp ? '已取餐' : '未取餐';
        lines.push(
          `${order.id}: ${order.type} | ${order.weight}kg | ¥${order.deliveryFee.toFixed(2)} | ${status}`
        );
      }
    }

    lines.push('\n=== 可用订单 ===');
    if (availableOrders.length === 0) {
      lines.push('无');
    } else {
      const nearby = availableOrders.slice(0, 5); // 只显示前 5 个
      for (const order of nearby) {
        lines.push(
          `${order.id}: ${order.type} | ${order.weight}kg | ¥${order.deliveryFee.toFixed(2)} | ${order.distance.toFixed(1)}km`
        );
      }
      if (availableOrders.length > 5) {
        lines.push(`... 还有 ${availableOrders.length - 5} 个订单`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 渲染简化版本（用于快速更新）
   */
  renderCompact(): string {
    const agentState = this.simulator.getAgentState();
    const currentTime = this.simulator.getCurrentTime();
    const formattedTime = GameClock.formatTime(currentTime);
    
    return `[${formattedTime}] Battery: ${agentState.getBattery().toFixed(0)}% | Profit: ¥${agentState.getProfit().toFixed(2)} | Completed: ${agentState.getCompletedOrders()}`;
  }

  /**
   * 设置更新间隔
   */
  setUpdateInterval(interval: number): void {
    this.config.updateInterval = interval;
  }

  /**
   * 获取配置
   */
  getConfig(): DisplayConfig {
    return { ...this.config };
  }
}
