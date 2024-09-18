import { IRabbitMqMessageOptions } from './rabbitmq-message-options'
import { ITimeSpan } from './timespan'
import { Options } from 'amqplib'

export interface IExchangeOptions extends Options.AssertExchange {
  readonly type: string
  readonly assert?: boolean
}

export interface IQueueOptions extends Options.AssertQueue {
  readonly assert?: boolean
}

export interface IExchange {
  readonly name: string
  readonly options?: IExchangeOptions
}

export interface IQueue {
  readonly name: string
  readonly options?: IQueueOptions
}

export interface IRabbitMqMessage {
  readonly exchange: IExchange
  readonly routingKey: string
  readonly data: any
  readonly options?: IRabbitMqMessageOptions
  readonly queue?: IQueue
}

export interface IRabbitMqScheduledMessage extends IRabbitMqMessage {
  readonly delay: ITimeSpan
}