export interface IRabbitMqErrorMessage {
  message: string
  error: Error
}

export interface IRabbitMqLogger {
  readonly traceId: string

  setTraceId(traceId: string): void

  error(message: IRabbitMqErrorMessage): void
}