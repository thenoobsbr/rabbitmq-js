import {Options} from "amqplib";
import AssertExchange = Options.AssertExchange;

export type ExchangeType = 'fanout' | 'direct' | 'topic' | 'headers' | 'match'

export interface IRabbitMqExchangeOptions extends AssertExchange {
}

export interface IRabbitMqExchange {
    readonly assert?: boolean
    readonly name: string
    readonly type: ExchangeType
    readonly options: IRabbitMqExchangeOptions
}