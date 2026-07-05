interface Timer {
  id: number;
  elapsed: number;
  paused: boolean;
  repeat: boolean;
  interval: number;
  callback: () => void;
}

export default class TimeManager {
  private timers: Timer[] = [];
  private counterId: number = 0;
  private readonly fixed_delta: number = 1 / 60;
  private accumulator: number = 0;

  // 1.0 = Normal time flow, 0.5 = Half speed slow-motion, 0.0 = Paused
  public timeScale: number = 1.0;

  public accumulate(dt: number) {
    const scaledDt = dt * this.timeScale;
    const safeDt = Math.min(scaledDt, 0.25);
    this.accumulator += safeDt;
    return Math.floor(this.accumulator / this.fixed_delta);
  }

  public consumeStep() {
    if (this.accumulator < this.fixed_delta) return;
    this.accumulator -= this.fixed_delta;
  }

  /**
   * Sets the game's current simulation time speed multiplier
   */
  public setSlowMo(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }

  public add(
    interval: number,
    callback: () => void,
    repeat: boolean = true,
  ): number {
    const id = this.counterId++;
    this.timers.push({
      id,
      interval,
      callback,
      elapsed: 0,
      paused: false,
      repeat,
    });
    return id;
  }

  public setInterval(interval: number, callback: () => void): number {
    return this.add(interval, callback, true);
  }

  public setTimeout(interval: number, callback: () => void): number {
    return this.add(interval, callback, false);
  }

  public pauseTimer(id: number): void {
    const timer = this.timers.find((t) => t.id === id);
    if (timer) timer.paused = true;
  }

  public resumeTimer(id: number): void {
    const timer = this.timers.find((t) => t.id === id);
    if (timer) timer.paused = false;
  }

  /**
   * Drives active clock tickers using the current slow-mo delta scalar
   */
  public update(dt: number): void {
    // Apply time dilation multiplier directly onto incoming delta tick updates!
    const scaledDt = dt * this.timeScale;

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (t.paused) continue;

      t.elapsed += scaledDt;
      if (t.elapsed >= t.interval) {
        t.callback();
        if (t.repeat) {
          t.elapsed -= t.interval;
        } else {
          this.timers.splice(i, 1);
        }
      }
    }
  }

  public clearAll(): void {
    this.timers = [];
    this.counterId = 0;
  }
}
