import {
  IRabbitMqLogger,
  IRabbitMqMessage,
  IRabbitMqPublisher,
  IRabbitMqScheduledMessage,
  IRabbitMqSerializer,
  ITimeSpan,
} from '../types'
import { IRabbitMqConnectionFactory } from '../extensions'
import { PublishFailedError } from '../errors'

export class RabbitMqPublisher implements IRabbitMqPublisher {
  constructor(
    private readonly connectionFactory: IRabbitMqConnectionFactory,
    private readonly serializer: IRabbitMqSerializer,
    private readonly logger: IRabbitMqLogger) {
  }

  private static calculateDelayInMilliseconds(delay: ITimeSpan) {
    return (delay.days ?? 0) * 24 * 60 * 60 * 1000
      + (delay.hours ?? 0) * 60 * 60 * 1000
      + (delay.minutes ?? 0) * 60 * 1000
      + (delay.seconds ?? 0) * 1000
      + (delay.milliseconds ?? 0)
  }

  async publish(...messages: IRabbitMqMessage[]): Promise<boolean> {
    try {
      const connection = await this.connectionFactory.getConnection()
      const confirmChannel = await connection.createConfirmChannel()
      for (const message of messages) {
        const data = message.data instanceof Buffer
          ? message.data
          : Buffer.from(this.serializer.serialize(message.data))
        const enqueued = confirmChannel.publish(
          message.exchange,
          message.routingKey,
          data,
          message.options,
        )

        if (!enqueued) {
          const error = new PublishFailedError('Failed to publish message')
          this.logger.error({
            message: 'Failed to publish message',
            error,
          })
          return false
        }
      }

      await confirmChannel.waitForConfirms()
      return true
    } catch (error: Error | any) {
      this.logger.error({ message: 'Failed to publish message', error })
      return false
    }
  }

  async schedule({
                   exchange,
                   routingKey,
                   data,
                   options,
                   delay,
                 }: IRabbitMqScheduledMessage): Promise<boolean> {
    const connection = await this.connectionFactory.getConnection()
    try {
      const channel = await connection.createConfirmChannel()
      try {
        await channel.checkQueue(routingKey)
        const schedulerQueue = `${routingKey}.scheduler`
        await channel.assertQueue(schedulerQueue, {
          durable: true,
          deadLetterExchange: '',
          deadLetterRoutingKey: routingKey,
          autoDelete: true,
        })
        await channel.waitForConfirms()

        const delayInMilliseconds = RabbitMqPublisher.calculateDelayInMilliseconds(delay)
        return await this.publish({
          exchange,
          routingKey: schedulerQueue,
          data,
          options: {
            ...options,
            persistent: true,
            expiration: delayInMilliseconds,
          },
        })
      } finally {
        await channel.close()
      }
    } catch (error: Error | any) {
      this.logger.error({ message: 'Failed to schedule message', error })
      return false
    }
  }
}