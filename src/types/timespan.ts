export interface ITimeSpan {
  readonly days?: number
  readonly hours?: number
  readonly minutes?: number
  readonly seconds?: number
  readonly milliseconds?: number
}

export class TimeSpan implements ITimeSpan {
  private readonly _totalMilliseconds: number

  constructor(private readonly timeSpan: ITimeSpan) {
    this._totalMilliseconds = TimeSpan.getTotalMilliseconds(timeSpan)
  }

  get days(): number | undefined {
    return this.timeSpan.days
  }

  get hours(): number | undefined {
    return this.timeSpan.hours
  }

  get minutes(): number | undefined {
    return this.timeSpan.minutes
  }

  get seconds(): number | undefined {
    return this.timeSpan.seconds
  }

  get milliseconds(): number | undefined {
    return this.timeSpan.milliseconds
  }

  get totalMilliseconds(): number {
    return this._totalMilliseconds
  }

  public static getTotalMilliseconds(timeSpan: ITimeSpan): number {
    return (
      (timeSpan.days ?? 0) * 24 * 60 * 60 * 1000 +
      (timeSpan.hours ?? 0) * 60 * 60 * 1000 +
      (timeSpan.minutes ?? 0) * 60 * 1000 +
      (timeSpan.seconds ?? 0) * 1000 +
      (timeSpan.milliseconds ?? 0)
    )
  }

  public static min(...timeSpans: ITimeSpan[]): ITimeSpan {
    return timeSpans.reduce((min, timeSpan) => TimeSpan.getTotalMilliseconds(min) < TimeSpan.getTotalMilliseconds(timeSpan) ? min : timeSpan)
  }

  public static max(...timeSpans: ITimeSpan[]): ITimeSpan {
    return timeSpans.reduce((max, timeSpan) => TimeSpan.getTotalMilliseconds(max) > TimeSpan.getTotalMilliseconds(timeSpan) ? max : timeSpan)
  }
}