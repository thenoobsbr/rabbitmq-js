import { IRabbitMqMessage, IRabbitMqScheduledMessage } from './rabbitmq-message'

export interface IRabbitMqPublisher {
  publish(...messages: IRabbitMqMessage[]): Promise<boolean>

  schedule(message: IRabbitMqScheduledMessage): Promise<boolean>
}