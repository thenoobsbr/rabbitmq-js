import { Connection } from 'amqplib'

export interface IRabbitMqConnectionFactory {
  getConnection(): Promise<Connection>
}