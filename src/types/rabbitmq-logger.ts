export interface IRabbitMqErrorMessage {
  message: string
  error: Error
}

export interface IRabbitMqLogger {
  error(message: IRabbitMqErrorMessage): void
}