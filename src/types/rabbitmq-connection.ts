import {IRabbitMqPublisher} from "./rabbitmq-publisher";

export interface IRabbitMqConnection {
    getPublisher(): IRabbitMqPublisher
}