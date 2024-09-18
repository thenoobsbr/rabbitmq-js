import { IRabbitMqRetryBehavior, ITimeSpan, TimeSpan } from '../types'

export class RabbitMqLinearRetryBehavior implements IRabbitMqRetryBehavior {
  constructor(
    private readonly maxAttempts: number = 10,
    private readonly delayCoefficient: number = 5,
    private readonly maxDelay: ITimeSpan = {
      seconds: 30,
    }) {
  }

  canRetry(attempt: number): boolean {
    return attempt <= this.maxAttempts
  }

  getDelay(attempt: number): ITimeSpan {
    return TimeSpan.min(this.maxDelay, {
      seconds: attempt * this.delayCoefficient,
    })
  }
}