/**
 * 游戏时钟系统测试
 * 包含单元测试和属性测试
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GameClock } from './game-clock';

describe('GameClock', () => {
  describe('基本功能', () => {
    it('应该使用默认值初始化（0:00 到 24:00）', () => {
      const clock = new GameClock();
      expect(clock.getCurrentTime()).toBe(0);
      expect(clock.getStartTime()).toBe(0);
      expect(clock.getEndTime()).toBe(1440);
    });

    it('应该使用自定义开始和结束时间初始化', () => {
      const clock = new GameClock(480, 960); // 8:00 到 16:00
      expect(clock.getCurrentTime()).toBe(480);
      expect(clock.getStartTime()).toBe(480);
      expect(clock.getEndTime()).toBe(960);
    });

    it('应该拒绝无效的开始时间', () => {
      expect(() => new GameClock(-1, 1440)).toThrow();
      expect(() => new GameClock(1440, 1440)).toThrow();
    });

    it('应该拒绝无效的结束时间', () => {
      expect(() => new GameClock(0, 0)).toThrow();
      expect(() => new GameClock(100, 50)).toThrow();
      expect(() => new GameClock(0, 1441)).toThrow();
    });

    it('应该推进时间', () => {
      const clock = new GameClock();
      clock.advance(30);
      expect(clock.getCurrentTime()).toBe(30);
      clock.advance(15);
      expect(clock.getCurrentTime()).toBe(45);
    });

    it('应该拒绝负数时间推进', () => {
      const clock = new GameClock();
      expect(() => clock.advance(-10)).toThrow();
    });

    it('应该检测是否达到结束时间', () => {
      const clock = new GameClock(0, 100);
      expect(clock.hasReachedEnd()).toBe(false);
      
      clock.advance(99);
      expect(clock.hasReachedEnd()).toBe(false);
      
      clock.advance(1);
      expect(clock.hasReachedEnd()).toBe(true);
      
      clock.advance(10);
      expect(clock.hasReachedEnd()).toBe(true);
    });

    it('应该计算剩余时间', () => {
      const clock = new GameClock(0, 100);
      expect(clock.getRemainingTime()).toBe(100);
      
      clock.advance(30);
      expect(clock.getRemainingTime()).toBe(70);
      
      clock.advance(80);
      expect(clock.getRemainingTime()).toBe(0);
    });

    it('应该计算已经过时间', () => {
      const clock = new GameClock(0, 100);
      expect(clock.getElapsedTime()).toBe(0);
      
      clock.advance(30);
      expect(clock.getElapsedTime()).toBe(30);
      
      clock.advance(20);
      expect(clock.getElapsedTime()).toBe(50);
    });

    it('应该格式化时间', () => {
      expect(GameClock.formatTime(0)).toBe('00:00');
      expect(GameClock.formatTime(60)).toBe('01:00');
      expect(GameClock.formatTime(125)).toBe('02:05');
      expect(GameClock.formatTime(1439)).toBe('23:59');
    });

    it('应该重置时钟', () => {
      const clock = new GameClock(100, 500);
      clock.advance(50);
      expect(clock.getCurrentTime()).toBe(150);
      
      clock.reset();
      expect(clock.getCurrentTime()).toBe(100);
    });
  });

  describe('属性测试', () => {
    /**
     * Feature: silicon-rider-bench, Property 4: 时间推进一致性
     * 
     * 属性 4：时间推进一致性
     * *对于任意*操作，执行后游戏时钟应该推进该操作的时间成本，且时钟值应该单调递增
     * 
     * **验证：需求 3.2**
     */
    it('属性 4: 时间推进一致性 - 时钟应该单调递增', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1439 }), // startTime
          fc.integer({ min: 1, max: 1440 }), // duration
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 50 }), // operations
          (startTime, duration, operations) => {
            const endTime = Math.min(1440, startTime + duration);
            if (endTime <= startTime) return true; // Skip invalid cases

            const clock = new GameClock(startTime, endTime);
            let previousTime = clock.getCurrentTime();

            for (const timeCost of operations) {
              const beforeTime = clock.getCurrentTime();
              clock.advance(timeCost);
              const afterTime = clock.getCurrentTime();

              // 时间应该推进正确的量
              expect(afterTime).toBe(beforeTime + timeCost);

              // 时间应该单调递增（或相等，如果 timeCost 为 0）
              expect(afterTime).toBeGreaterThanOrEqual(previousTime);

              previousTime = afterTime;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('属性 4: 时间推进一致性 - 多次推进应该累加', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }), // startTime
          fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 2, maxLength: 20 }), // time increments
          (startTime, increments) => {
            const totalIncrement = increments.reduce((sum, inc) => sum + inc, 0);
            const endTime = Math.min(1440, startTime + totalIncrement + 100);
            
            // Skip if endTime would be invalid
            if (endTime <= startTime) return true;

            const clock = new GameClock(startTime, endTime);
            const initialTime = clock.getCurrentTime();

            // 逐个推进
            for (const increment of increments) {
              clock.advance(increment);
            }

            const finalTime = clock.getCurrentTime();

            // 最终时间应该等于初始时间加上所有增量
            expect(finalTime).toBe(initialTime + totalIncrement);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('属性 4: 时间推进一致性 - 推进零分钟不改变时间', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1439 }), // startTime
          fc.integer({ min: 1, max: 1000 }), // some initial advance
          (startTime, initialAdvance) => {
            const clock = new GameClock(startTime, 1440);
            clock.advance(initialAdvance);
            
            const timeBefore = clock.getCurrentTime();
            clock.advance(0);
            const timeAfter = clock.getCurrentTime();

            // 推进 0 分钟不应该改变时间
            expect(timeAfter).toBe(timeBefore);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('属性测试: 结束时间检测一致性', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 900 }), // startTime (leave room for duration)
          fc.integer({ min: 100, max: 500 }), // duration
          (startTime, duration) => {
            const endTime = Math.min(1440, startTime + duration);
            
            // Skip if endTime would be invalid
            if (endTime <= startTime) return true;

            const clock = new GameClock(startTime, endTime);

            // 在达到结束时间之前，hasReachedEnd 应该返回 false
            expect(clock.hasReachedEnd()).toBe(false);

            // 推进到结束时间之前
            const actualDuration = endTime - startTime;
            if (actualDuration > 1) {
              clock.advance(actualDuration - 1);
              expect(clock.hasReachedEnd()).toBe(false);

              // 推进到结束时间
              clock.advance(1);
            } else {
              clock.advance(actualDuration);
            }
            expect(clock.hasReachedEnd()).toBe(true);

            // 继续推进，仍然应该返回 true
            clock.advance(10);
            expect(clock.hasReachedEnd()).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('属性测试: 剩余时间和已过时间互补', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 900 }), // startTime (leave room for duration)
          fc.integer({ min: 100, max: 500 }), // duration
          fc.integer({ min: 0, max: 100 }), // advance amount
          (startTime, duration, advanceAmount) => {
            const endTime = Math.min(1440, startTime + duration);
            
            // Skip if endTime would be invalid
            if (endTime <= startTime) return true;

            const clock = new GameClock(startTime, endTime);
            const actualDuration = endTime - startTime;

            const safeAdvance = Math.min(advanceAmount, actualDuration);
            clock.advance(safeAdvance);

            const elapsed = clock.getElapsedTime();
            const remaining = clock.getRemainingTime();

            // 已过时间 + 剩余时间应该等于总时长
            expect(elapsed + remaining).toBe(actualDuration);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
