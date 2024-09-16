import { connect, Connection } from 'amqplib'
import { IRabbitMqConnectionFactory } from './extensions'
import {
  IRabbitMqConnection,
  IRabbitMqConnectionOptions,
  IRabbitMqLogger,
  IRabbitMqPublisher,
  IRabbitMqSerializer,
  IRabbitMqSubscribe,
} from './types'
import { RabbitMqPublisher } from './publisher'
import { RabbitMqSubscription } from './subscription'

export class RabbitMqConnection implements IRabbitMqConnection, IRabbitMqConnectionFactory {
  private connection: Connection | undefined

  constructor(private readonly options: IRabbitMqConnectionOptions,
              private readonly serializer: IRabbitMqSerializer,
              private readonly logger: IRabbitMqLogger) {
  }

  getPublisher(): IRabbitMqPublisher {
    return new RabbitMqPublisher(this, this.serializer, this.logger)
  }

  subscribe(options: IRabbitMqSubscribe) {
    return new RabbitMqSubscription(this,
      this.serializer,
      options,
      this.getPublisher(),
      this.logger)
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
      this.logger.error({ message: 'Failed to open connection', error })
      throw error
    }
  }

  private onConnectionError(error: Error) {
    console.error(error)
    this.connection?.removeAllListeners()
    this.connection = undefined
    this.logger.error({ message: 'Connection failed', error })
  }
}