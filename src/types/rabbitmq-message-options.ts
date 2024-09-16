import { Options } from 'amqplib'
import Publish = Options.Publish

export interface IRabbitMqMessageOptions extends Publish {
}