import {IRabbitMqMessage, IRabbitMqScheduledMessage} from "./rabbitmq-message";

export interface IRabbitMqPublisher {
    publish(message: IRabbitMqMessage): Promise<void>

    schedule(message: IRabbitMqScheduledMessage): Promise<void>
}