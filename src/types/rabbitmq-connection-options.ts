export interface IRabbitMqConnectionOptions {
  readonly connectionString: string
  readonly appName: string
  readonly timeoutInMilliseconds?: number
  readonly heartbeatInSeconds?: number
}