/**
 * 报告生成器
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 需求：14.5
 */

import { ScoreMetrics, OrderCompletionRecord } from './score-calculator';

/**
 * 报告配置
 */
export interface ReportConfig {
  level: string;              // Level 名称（如 "0.1" 或 "1"）
  seed: number;               // 地图种子
  duration: number;           // 模拟时长（分钟）
  modelName?: string;         // AI 模型名称
  startTime?: string;         // 开始时间
  endTime?: string;           // 结束时间
}

/**
 * 报告生成器类
 * 
 * 负责生成 Markdown 格式的评测报告
 */
export class ReportGenerator {
  /**
   * 生成完整的 Markdown 报告
   * 需求：14.5
   * 
   * @param config 报告配置
   * @param metrics 评分指标
   * @param completionRecords 订单完成记录（可选，用于详细分析）
   * @returns Markdown 格式的报告
   */
  static generateReport(
    config: ReportConfig,
    metrics: ScoreMetrics,
    completionRecords?: OrderCompletionRecord[]
  ): string {
    const sections: string[] = [];
    
    // 标题
    sections.push('# Silicon Rider Bench - 评测报告\n');
    
    // 基本信息
    sections.push(this.generateBasicInfo(config));
    
    // 核心指标
    sections.push(this.generateCoreMetrics(metrics));
    
    // 详细统计
    sections.push(this.generateDetailedStats(metrics));
    
    // 订单类型分布
    sections.push(this.generateOrderDistribution(metrics));
    
    // 性能分析（如果有订单完成记录）
    if (completionRecords && completionRecords.length > 0) {
      sections.push(this.generatePerformanceAnalysis(completionRecords));
    }
    
    // 评价总结
    sections.push(this.generateSummary(metrics));
    
    return sections.join('\n');
  }

  /**
   * 生成基本信息部分
   */
  private static generateBasicInfo(config: ReportConfig): string {
    const lines: string[] = [
      '## 基本信息\n',
      `- **Level**: ${config.level}`,
      `- **Seed**: ${config.seed}`,
      `- **Duration**: ${this.formatDuration(config.duration)}`,
    ];
    
    if (config.modelName) {
      lines.push(`- **Model**: ${config.modelName}`);
    }
    
    if (config.startTime) {
      lines.push(`- **Start Time**: ${config.startTime}`);
    }
    
    if (config.endTime) {
      lines.push(`- **End Time**: ${config.endTime}`);
    }
    
    return lines.join('\n') + '\n';
  }

  /**
   * 生成核心指标部分
   */
  private static generateCoreMetrics(metrics: ScoreMetrics): string {
    return [
      '## 核心指标\n',
      `- **总利润**: ¥${metrics.totalProfit.toFixed(2)}`,
      `- **完成订单数**: ${metrics.completedOrders}`,
      `- **准时率**: ${(metrics.onTimeRate * 100).toFixed(1)}% (${metrics.onTimeOrders}/${metrics.completedOrders})`,
      `- **路径效率**: ${metrics.pathEfficiency.toFixed(2)}`,
      `- **API 违规率**: ${(metrics.apiViolationRate * 100).toFixed(1)}% (${metrics.invalidToolCalls}/${metrics.totalToolCalls})`,
      '',
    ].join('\n');
  }

  /**
   * 生成详细统计部分
   */
  private static generateDetailedStats(metrics: ScoreMetrics): string {
    const overtimeOrders = metrics.completedOrders - metrics.onTimeOrders;
    
    return [
      '## 详细统计\n',
      `- **总行驶距离**: ${metrics.totalDistance.toFixed(1)} km`,
      `- **理论最优距离**: ${metrics.optimalDistance.toFixed(1)} km`,
      `- **换电次数**: ${metrics.batterySwaps}`,
      `- **总收入**: ¥${metrics.totalRevenue.toFixed(2)}`,
      `- **总惩罚**: ¥${metrics.totalPenalty.toFixed(2)}`,
      `- **总成本**: ¥${metrics.totalCost.toFixed(2)}`,
      `- **平均每单利润**: ¥${metrics.averageProfit.toFixed(2)}`,
      `- **超时订单数**: ${overtimeOrders}`,
      `- **平均超时时长**: ${metrics.averageOvertime.toFixed(1)} 分钟`,
      `- **总工具调用数**: ${metrics.totalToolCalls}`,
      `- **无效工具调用数**: ${metrics.invalidToolCalls}`,
      '',
    ].join('\n');
  }

  /**
   * 生成订单类型分布部分
   */
  private static generateOrderDistribution(metrics: ScoreMetrics): string {
    const total = metrics.completedOrders;
    
    if (total === 0) {
      return '## 订单类型分布\n\n无完成订单\n';
    }
    
    const foodPercent = (metrics.foodOrders / total * 100).toFixed(1);
    const supermarketPercent = (metrics.supermarketOrders / total * 100).toFixed(1);
    const pharmacyPercent = (metrics.pharmacyOrders / total * 100).toFixed(1);
    
    return [
      '## 订单类型分布\n',
      `- **餐饮订单**: ${metrics.foodOrders} (${foodPercent}%)`,
      `- **超市订单**: ${metrics.supermarketOrders} (${supermarketPercent}%)`,
      `- **药店订单**: ${metrics.pharmacyOrders} (${pharmacyPercent}%)`,
      '',
    ].join('\n');
  }

  /**
   * 生成性能分析部分
   */
  private static generatePerformanceAnalysis(
    records: OrderCompletionRecord[]
  ): string {
    if (records.length === 0) {
      return '';
    }
    
    // 找出最赚钱和最亏损的订单
    const sortedByProfit = [...records].sort(
      (a, b) => (b.payment - b.penalty) - (a.payment - a.penalty)
    );
    const mostProfitable = sortedByProfit[0];
    const leastProfitable = sortedByProfit[sortedByProfit.length - 1];
    
    // 找出超时最严重的订单
    const sortedByOvertime = [...records].sort((a, b) => b.overtime - a.overtime);
    const mostOvertime = sortedByOvertime[0];
    
    const lines: string[] = [
      '## 性能分析\n',
      '### 最佳订单',
      `- **订单 ID**: ${mostProfitable.orderId}`,
      `- **类型**: ${this.translateOrderType(mostProfitable.orderType)}`,
      `- **收益**: ¥${mostProfitable.payment.toFixed(2)}`,
      `- **距离**: ${mostProfitable.distance.toFixed(1)} km`,
      '',
    ];
    
    if (leastProfitable.penalty > 0) {
      lines.push(
        '### 最差订单',
        `- **订单 ID**: ${leastProfitable.orderId}`,
        `- **类型**: ${this.translateOrderType(leastProfitable.orderType)}`,
        `- **收益**: ¥${leastProfitable.payment.toFixed(2)}`,
        `- **惩罚**: ¥${leastProfitable.penalty.toFixed(2)}`,
        `- **超时**: ${leastProfitable.overtime.toFixed(1)} 分钟`,
        ''
      );
    }
    
    if (mostOvertime.overtime > 0) {
      lines.push(
        '### 超时最严重订单',
        `- **订单 ID**: ${mostOvertime.orderId}`,
        `- **超时时长**: ${mostOvertime.overtime.toFixed(1)} 分钟`,
        `- **惩罚**: ¥${mostOvertime.penalty.toFixed(2)}`,
        ''
      );
    }
    
    return lines.join('\n');
  }

  /**
   * 生成评价总结部分
   */
  private static generateSummary(metrics: ScoreMetrics): string {
    const lines: string[] = ['## 评价总结\n'];
    
    // 利润评价
    if (metrics.totalProfit > 0) {
      lines.push(`✅ 成功盈利 ¥${metrics.totalProfit.toFixed(2)}`);
    } else {
      lines.push(`❌ 亏损 ¥${Math.abs(metrics.totalProfit).toFixed(2)}`);
    }
    
    // 准时率评价
    if (metrics.onTimeRate >= 0.9) {
      lines.push(`✅ 准时率优秀 (${(metrics.onTimeRate * 100).toFixed(1)}%)`);
    } else if (metrics.onTimeRate >= 0.7) {
      lines.push(`⚠️ 准时率良好 (${(metrics.onTimeRate * 100).toFixed(1)}%)`);
    } else {
      lines.push(`❌ 准时率需要改进 (${(metrics.onTimeRate * 100).toFixed(1)}%)`);
    }
    
    // 路径效率评价
    if (metrics.pathEfficiency <= 1.2) {
      lines.push(`✅ 路径效率优秀 (${metrics.pathEfficiency.toFixed(2)})`);
    } else if (metrics.pathEfficiency <= 1.5) {
      lines.push(`⚠️ 路径效率良好 (${metrics.pathEfficiency.toFixed(2)})`);
    } else {
      lines.push(`❌ 路径效率需要改进 (${metrics.pathEfficiency.toFixed(2)})`);
    }
    
    // API 违规率评价
    if (metrics.apiViolationRate <= 0.05) {
      lines.push(`✅ API 使用规范 (违规率 ${(metrics.apiViolationRate * 100).toFixed(1)}%)`);
    } else if (metrics.apiViolationRate <= 0.1) {
      lines.push(`⚠️ API 使用基本规范 (违规率 ${(metrics.apiViolationRate * 100).toFixed(1)}%)`);
    } else {
      lines.push(`❌ API 使用需要改进 (违规率 ${(metrics.apiViolationRate * 100).toFixed(1)}%)`);
    }
    
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * 格式化时长
   */
  private static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:00`;
    } else {
      return `${mins}:00`;
    }
  }

  /**
   * 翻译订单类型
   */
  private static translateOrderType(type: string): string {
    const translations: Record<string, string> = {
      food: '餐饮',
      supermarket: '超市',
      pharmacy: '药店',
    };
    return translations[type] || type;
  }

  /**
   * 生成简短摘要（用于终端显示）
   */
  static generateShortSummary(
    config: ReportConfig,
    metrics: ScoreMetrics
  ): string {
    return [
      `Level ${config.level} | Seed: ${config.seed}`,
      `利润: ¥${metrics.totalProfit.toFixed(2)} | 订单: ${metrics.completedOrders}`,
      `准时率: ${(metrics.onTimeRate * 100).toFixed(1)}% | 路径效率: ${metrics.pathEfficiency.toFixed(2)}`,
      `API 违规率: ${(metrics.apiViolationRate * 100).toFixed(1)}%`,
    ].join('\n');
  }
}
