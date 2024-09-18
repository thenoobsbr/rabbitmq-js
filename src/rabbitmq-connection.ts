import { connect, Connection } from 'amqplib'
import { IRabbitMqConnectionFactory } from './extensions'
import {
  IRabbitMqConnection,
  IRabbitMqConnectionOptions,
  IRabbitMqLogger,
  IRabbitMqPublisher,
  IRabbitMqSerializer,
  IRabbitMqSubscribe,
  IRabbitMqSubscription,
} from './types'
import { RabbitMqPublisher } from './publisher'
import { RabbitMqSubscription } from './subscription'

export class RabbitMqConnection implements IRabbitMqConnection, IRabbitMqConnectionFactory {
  private connection: Connection | undefined
  private readonly publishers: IRabbitMqPublisher[] = []
  private readonly subscriptions: IRabbitMqSubscription[] = []

  constructor(private readonly options: IRabbitMqConnectionOptions,
              private readonly serializer: IRabbitMqSerializer,
              private readonly logger?: IRabbitMqLogger) {
  }

  getPublisher(): IRabbitMqPublisher {
    const publisher = new RabbitMqPublisher(this, this.serializer, this.logger)
    this.publishers.push(publisher)
    return publisher
  }

  subscribe(options: IRabbitMqSubscribe) {
    const subscription = new RabbitMqSubscription(this,
      this.serializer,
      options,
      this.getPublisher(),
      this.logger)
    this.subscriptions.push(subscription)
    return subscription
  }

  async close(): Promise<void> {
    for (const subscription of this.subscriptions) {
      try {
        await subscription.stop()
      } catch (error: Error | any) {
        this.logger?.error({ message: 'Failed to stop subscription', error })
      }
    }

    for (const publisher of this.publishers) {
      try {
        await publisher.close()
      } catch (error: Error | any) {
        this.logger?.error({ message: 'Failed to stop publisher', error })
      }
    }
    
    try {
      this.connection?.removeAllListeners()
      await this.connection?.close()
    } catch (error: Error | any) {
      this.logger?.error({ message: 'Failed to close connection', error })
    }
  }

  async getConnection(): Promise<Connection> {
    return this.connection = this.connection ?? await this.openConnection()
  }

  private async openConnection(): Promise<Connection> {
    try {
      const connection = await connect(this.options.connectionString, {
        clientProperties: {
          connection_name: this.options.appName,
        },
        timeout: this.options.timeoutInMilliseconds,
        heartbeatInterval: this.options.heartbeatInSeconds,
      })
      connection.on('error', this.onConnectionError.bind(this))
      connection.on('close', this.onConnectionError.bind(this))
      return connection
    } catch (error: Error | any) {
      this.logger?.error({ message: 'Failed to open connection', error })
      throw error
    }
  }

  private onConnectionError(error: Error) {
    this.logger?.error({
      message: 'Connection closed',
      error,
    })
    this.connection?.removeAllListeners()
    this.connection = undefined
  }
}