import { InstantiateType } from './instantiate-type'

export interface IRabbitMqSerializer {
  serialize<T>(data: T): string

  deserialize<T>(type: InstantiateType, data: string): T
}