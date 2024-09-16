import { IRabbitMqRetryBehavior, IRabbitMqSubscriberMessage } from '../subscription'
import { InstantiateType } from './instantiate-type'

export type RabbitMqSubscriberCallback = <T>(message: IRabbitMqSubscriberMessage<T>) => Promise<void>

export interface IRabbitMqSubscribe {
  readonly queue: string
  readonly retryBehavior: IRabbitMqRetryBehavior
  readonly type: InstantiateType
  readonly callback: RabbitMqSubscriberCallback
  readonly prefetch: number
}