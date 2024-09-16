export interface IRabbitMqSubscription {
  start(): Promise<boolean>

  stop(): Promise<void>
}