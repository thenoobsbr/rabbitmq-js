import {IRabbitMqMessageOptions} from "./rabbitmq-message-options";
import {ITimeSpan} from "./timespan";

export interface IRabbitMqMessage {
    readonly exchange: string
    readonly routingKey: string
    readonly data: any
    readonly options?: IRabbitMqMessageOptions
}

export interface IRabbitMqScheduledMessage extends IRabbitMqMessage {
    readonly delay: ITimeSpan
}