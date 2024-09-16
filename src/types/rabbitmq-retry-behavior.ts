import { ITimeSpan } from './timespan'

export interface IRabbitMqRetryBehavior {
  getDelay(attempt: number): ITimeSpan

  canRetry(attempt: number): boolean
}