import {
  IRabbitMqLogger,
  IRabbitMqMessage,
  IRabbitMqPublisher,
  IRabbitMqScheduledMessage,
  IRabbitMqSerializer,
  TimeSpan,
} from '../types'
import { IRabbitMqConnectionFactory } from '../extensions'
import { PublishFailedError } from '../errors'

export class RabbitMqPublisher implements IRabbitMqPublisher {
  private readonly existingExchanges: Set<string> = new Set()
  private readonly existingQueues: Set<string> = new Set()

  constructor(
    private readonly connectionFactory: IRabbitMqConnectionFactory,
    private readonly serializer: IRabbitMqSerializer,
    private readonly logger?: IRabbitMqLogger) {
  }

  async publish(...messages: IRabbitMqMessage[]): Promise<boolean> {
    try {
      const connection = await this.connectionFactory.getConnection()
      const confirmChannel = await connection.createConfirmChannel()
      for (const message of messages) {
        if (message.exchange.options?.assert &&
          !this.existingExchanges.has(message.exchange.name)) {
          await confirmChannel.assertExchange(
            message.exchange.name,
            message.exchange.options.type,
            message.exchange.options)
        }

        if (message.queue?.options?.assert &&
          !this.existingQueues.has(message.queue.name)) {
          await confirmChannel.assertQueue(message.queue.name, message.queue.options)
        }

        const data = message.data instanceof Buffer
          ? message.data
          : Buffer.from(this.serializer.serialize(message.data))
        const enqueued = confirmChannel.publish(
          message.exchange.name,
          message.routingKey,
          data,
          {
            ...message.options,
            headers: {
              ...message.options?.headers,
              traceId: this.logger?.traceId,
            },
          },
        )

        if (!enqueued) {
          const error = new PublishFailedError('Failed to publish message')
          this.logger?.error({
            message: 'Failed to publish message',
            error,
          })
          return false
        }

        this.existingExchanges.add(message.exchange.name)
        if (message.queue?.name) {
          this.existingQueues.add(message.queue.name)
        }
      }

      await confirmChannel.waitForConfirms()
      return true
    } catch (error: Error | any) {
      this.logger?.error({ message: 'Failed to publish message', error })
      return false
    }
  }

  async schedule({
                   exchange,
                   routingKey,
                   data,
                   options,
                   delay,
                   queue,
                 }: IRabbitMqScheduledMessage): Promise<boolean> {
    if (queue?.name && routingKey != queue.name) {
      throw new PublishFailedError('The queue name must match the routing key')
    }

    try {
      const connection = await this.connectionFactory.getConnection()
      const channel = await connection.createChannel()
      try {
        if (queue?.options?.assert &&
          !this.existingQueues.has(queue.name)) {
          await channel.assertQueue(queue.name, queue.options)
          this.existingQueues.add(queue.name)
        }
        const schedulerQueue = `${routingKey}.scheduler`
        const delayInMilliseconds = TimeSpan.getTotalMilliseconds(delay)
        return await this.publish({
          exchange,
          routingKey: schedulerQueue,
          data,
          queue: {
            name: schedulerQueue,
            options: {
              durable: true,
              assert: true,
              deadLetterExchange: '',
              deadLetterRoutingKey: routingKey,
            },
          },
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
      this.logger?.error({ message: 'Failed to schedule message', error })
      return false
    }
  }
}