/**
 * 超时惩罚计算模块
 * 根据超时时长计算惩罚比例和最终支付金额
 */

import { Payment } from '../types';

/**
 * 计算超时惩罚和最终支付金额
 * 需求：9.2, 9.3, 22.1-22.5
 * 
 * 惩罚规则：
 * - 未超时（0分钟）：不扣款（0%）
 * - 超时0（不含）-5分钟（含）：扣除 30%
 * - 5分钟（不含）-10分钟（含）：扣除 50%
 * - 10分钟（不含）-20分钟（含）：扣除所有配送费（100%）
 * - 20分钟以上：扣除100%并在不挣钱基础上额外罚款10元
 * 
 * @param deliveryFee 订单配送费（元）
 * @param deadline 订单截止时间（游戏时间，分钟）
 * @param deliveryTime 实际送达时间（游戏时间，分钟）
 * @returns 支付结果（包含实际支付金额、惩罚金额和超时分钟数）
 */
export function calculatePayment(
  deliveryFee: number,
  deadline: number,
  deliveryTime: number
): Payment {
  // 计算超时时长（分钟）
  const overtime = Math.max(0, deliveryTime - deadline);
  
  // 根据超时时长确定惩罚比例和固定罚款
  let penaltyRate = 0;
  let fixedPenalty = 0;
  
  if (overtime === 0) {
    // 准时或提前：不扣款
    penaltyRate = 0;
  } else if (overtime <= 5) {
    // 超时0-5分钟（含）：扣除 30%
    penaltyRate = 0.3;
  } else if (overtime <= 10) {
    // 5分钟（不含）-10分钟（含）：扣除 50%
    penaltyRate = 0.5;
  } else if (overtime <= 20) {
    // 10分钟（不含）-20分钟（含）：扣除 100%
    penaltyRate = 1.0;
  } else {
    // 20分钟以上：扣除 100%，额外罚款 10 元
    penaltyRate = 1.0;
    fixedPenalty = 10;
  }
  
  // 计算惩罚金额
  const penalty = deliveryFee * penaltyRate + fixedPenalty;
  
  // 计算最终支付金额
  const payment = deliveryFee - penalty;
  
  return {
    payment,
    penalty,
    overtime
  };
}
