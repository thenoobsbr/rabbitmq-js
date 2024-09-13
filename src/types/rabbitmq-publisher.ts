import {IRabbitMqMessage, IRabbitMqScheduledMessage} from "./rabbitmq-message";

export interface IRabbitMqPublisher {
    publish(...messages: IRabbitMqMessage[]): Promise<void>

    schedule(message: IRabbitMqScheduledMessage): Promise<void>
}