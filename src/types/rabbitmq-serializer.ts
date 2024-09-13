export interface IRabbitMqSerializer {
    serialize<T>(data: T): string
    deserialize<T>(data: string): T
}