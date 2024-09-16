export interface IRabbitMqSubscriptionMessage<T> {
  readonly fields: any
  readonly properties: any
  readonly attempt: number
  readonly data: T
}