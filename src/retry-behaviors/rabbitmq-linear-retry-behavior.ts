import { IRabbitMqRetryBehavior, ITimeSpan } from '../types'

export class RabbitMqLinearRetryBehavior implements IRabbitMqRetryBehavior {
  constructor(private readonly maxAttempts: number = 3) {
  }

  canRetry(attempt: number): boolean {
    return attempt <= this.maxAttempts
  }

  getDelay(attempt: number): ITimeSpan {
    return {
      seconds: 5 * attempt,
    }
  }
}