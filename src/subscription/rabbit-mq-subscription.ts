import { IRabbitMqConnectionFactory, Task } from '../extensions'
import {
  IRabbitMqLogger,
  IRabbitMqPublisher,
  IRabbitMqSerializer,
  IRabbitMqSubscribe,
  IRabbitMqSubscription,
} from '../types'
import { ConfirmChannel, Message, Replies } from 'amqplib'
import Consume = Replies.Consume

export class RabbitMqSubscription implements IRabbitMqSubscription {
  private isClosed = false
  private isProcessing = false
  private channel: ConfirmChannel | undefined
  private subscription: Consume | undefined

  constructor(private readonly connectionFactory: IRabbitMqConnectionFactory,
              private readonly serializer: IRabbitMqSerializer,
              private readonly options: IRabbitMqSubscribe,
              private readonly publisher: IRabbitMqPublisher,
              private readonly logger?: IRabbitMqLogger) {
  }

  async start(): Promise<boolean> {
    try {
      const channel = await this.getChannel()
      await channel.prefetch(this.options.prefetch)

      if (this.options.exchange?.options?.assert) {
        await channel.assertExchange(
          this.options.exchange.name,
          this.options.exchange.options.type,
          this.options.exchange.options)
      }

      if (this.options.queue?.options?.assert) {
        await channel.assertQueue(this.options.queue.name, this.options.queue.options)
      }

      this.subscription = await channel.consume(this.options.queue.name, (message) => {
        this.isProcessing = true
        try {
          if (!message) {
            return
          }
          return this.processMessage(message)
        } finally {
          this.isProcessing = false
        }
      })
      return true
    } catch (error: Error | any) {
      this.logger?.error({ message: 'Failed to subscribe', error })
      this.channel = undefined
      return false
    }
  }

  async stop(): Promise<void> {
    this.isClosed = true

    if (this.subscription) {
      await this.channel?.cancel(this.subscription.consumerTag)
    }

    while (this.isProcessing) {
      await Task.delay({ milliseconds: 300 })
    }

    this.channel?.nackAll(true)
    await this.channel?.waitForConfirms()

    this.channel?.removeAllListeners()
    await this.channel?.close()
    this.channel = undefined
  }

  private async processMessage(message: Message): Promise<void> {
    const attempt = message.properties.headers?.attempt ?? 1
    const traceId = message.properties.headers?.traceId
    if (traceId) {
      this.logger?.setTraceId(traceId)
    }
    const channel = await this.getChannel()
    try {
      if (this.isClosed) {
        channel.nackAll(true)
        await channel.waitForConfirms()
        return
      }
      await this.options.callback({
        attempt,
        fields: message.fields,
        properties: message.properties,
        data: this.serializer.deserialize(this.options.type, message.content.toString()),
      })
      this.channel?.ack(message, false)
    } catch (error: Error | any) {
      this.logger?.error({
        message: 'Failed to process message',
        error,
      })
      try {
        this.options.retryBehavior?.canRetry(attempt)
          ? await this.scheduleAttempt(message, attempt + 1)
          : await this.publishToDlq(message)

        channel.nack(message, false, false)
      } catch (error: Error | any) {
        this.logger?.error({
          message: 'Failed process retry',
          error,
        })
        channel.nack(message, false, true)
      }
    } finally {
      await channel.waitForConfirms()
    }
  }

  private publishToDlq(message: Message): Promise<boolean> {
    const dlq = `${this.options.queue.name}.dlq`
    return this.publisher.publish({
      exchange: {
        name: '',
      },
      routingKey: dlq,
      data: message.content,
      queue: {
        name: dlq,
        options: {
          durable: true,
          assert: true,
        },
      },
      options: {
        ...message.properties,
        expiration: undefined,
      },
    })

  }

  private async scheduleAttempt(message: Message, attempt: number): Promise<void> {
    const delay = this.options.retryBehavior!.getDelay(attempt)
    await this.publisher.schedule({
      exchange: {
        name: '',
      },
      routingKey: this.options.queue.name,
      data: message.content,
      options: {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          attempt: attempt,
        },
      },
      delay,
    })
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel
    }
    const connection = await this.connectionFactory.getConnection()
    this.channel = await connection.createConfirmChannel()
    this.channel.on('error', this.onChannelError.bind(this))
    this.channel.on('close', this.onChannelError.bind(this))
    return this.channel
  }

  private async onChannelError(error: Error): Promise<void> {
    this.logger?.error({
      message: 'Channel failed',
      error,
    })
    this.channel?.removeAllListeners()
    this.channel = undefined
    this.subscription = undefined

    do {
      try {
        await this.start()
      } catch (error: Error | any) {
        this.logger?.error({
          message: 'Failed to recover subscription channel',
          error,
        })
        await Task.delay({ seconds: 1 })
      }
    } while (!this.channel)
  }
}