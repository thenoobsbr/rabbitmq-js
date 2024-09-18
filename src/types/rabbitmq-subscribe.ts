import { IRabbitMqRetryBehavior, IRabbitMqSubscriptionMessage } from '../types'
import { InstantiateType } from './instantiate-type'

export type RabbitMqSubscriberCallback = <T>(message: IRabbitMqSubscriptionMessage<T>) => Promise<void>

export interface IRabbitMqSubscribe {
  readonly queue: string
  readonly retryBehavior: IRabbitMqRetryBehavior
  readonly type: InstantiateType
  readonly callback: RabbitMqSubscriberCallback
  readonly prefetch: number
}