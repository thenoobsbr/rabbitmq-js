import { IExchange, IQueue, IRabbitMqRetryBehavior, IRabbitMqSubscriptionMessage } from '../types'
import { InstantiateType } from './instantiate-type'

export type RabbitMqSubscriberCallback = <T>(message: IRabbitMqSubscriptionMessage<T>) => Promise<void>

export interface IRabbitMqSubscribe {
  readonly exchange?: IExchange
  readonly queue: IQueue
  readonly retryBehavior?: IRabbitMqRetryBehavior
  readonly type: InstantiateType
  readonly callback: RabbitMqSubscriberCallback
  readonly prefetch: number
}