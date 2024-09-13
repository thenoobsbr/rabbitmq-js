import {connect, Connection} from "amqplib";
import {IRabbitMqConnectionFactory} from "./extensions";
import {IRabbitMqConnection, IRabbitMqConnectionOptions, IRabbitMqPublisher, IRabbitMqSerializer} from "./types";
import {RabbitMqPublisher} from "./publisher";

export class RabbitMqConnection implements IRabbitMqConnection, IRabbitMqConnectionFactory {
    private connection: Connection | undefined

    constructor(private readonly options: IRabbitMqConnectionOptions,
                private readonly serializer: IRabbitMqSerializer) {
    }

    getPublisher(): IRabbitMqPublisher {
        return new RabbitMqPublisher(this, this.serializer)
    }

    async getConnection(): Promise<Connection> {
        return this.connection = this.connection ?? await this.openConnection()
    }

    private async openConnection(): Promise<Connection> {
        const connection = await connect(this.options.connectionString, {
            clientProperties: {
                connection_name: this.options.appName,
            },
            timeout: this.options.timeoutInMilliseconds,
            heartbeatInterval: this.options.heartbeatInSeconds
        })
        connection.on('error', async _ => {
            try {
                this.connection?.removeAllListeners()
                await this.connection?.close()
            } catch {
                // do nothing
            } finally {
                this.connection = undefined
            }
        })
        return connection
    }
}