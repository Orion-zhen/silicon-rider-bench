/**
 * Seeded Random Number Generator using Mulberry32 algorithm
 * Provides deterministic random number generation for reproducible map generation
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    // Ensure seed is a 32-bit unsigned integer
    this.state = seed >>> 0;
  }

  /**
   * Generate next random number using Mulberry32 algorithm
   * Returns a value between 0 (inclusive) and 1 (exclusive)
   */
  nextFloat(): number {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in range [min, max] (inclusive)
   */
  nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error('min must be less than or equal to max');
    }
    const range = max - min + 1;
    return Math.floor(this.nextFloat() * range) + min;
  }

  /**
   * Generate random float in range [min, max)
   */
  nextFloatRange(min: number, max: number): number {
    if (min > max) {
      throw new Error('min must be less than or equal to max');
    }
    return this.nextFloat() * (max - min) + min;
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   * Returns the shuffled array
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate random boolean with given probability
   * @param probability - probability of returning true (0-1)
   */
  nextBoolean(probability: number = 0.5): boolean {
    return this.nextFloat() < probability;
  }

  /**
   * Pick random element from array
   */
  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.nextInt(0, array.length - 1)];
  }
}
