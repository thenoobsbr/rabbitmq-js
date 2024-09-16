import { IRabbitMqPublisher } from './rabbitmq-publisher'
import { IRabbitMqSubscribe } from './rabbitmq-subscribe'
import { IRabbitMqSubscription } from './rabbitmq-subscriber'

export interface IRabbitMqConnection {
  getPublisher(): IRabbitMqPublisher

  subscribe(options: IRabbitMqSubscribe): IRabbitMqSubscription
}