import {
    IRabbitMqMessage,
    IRabbitMqPublisher,
    IRabbitMqScheduledMessage,
    IRabbitMqSerializer,
    ITimeSpan
} from "../types";
import {IRabbitMqConnectionFactory} from "../extensions";

export class RabbitMqPublisher implements IRabbitMqPublisher {
    constructor(
        private readonly connectionFactory: IRabbitMqConnectionFactory,
        private readonly serializer: IRabbitMqSerializer) {
    }

    private static calculateDelayInMilliseconds(delay: ITimeSpan) {
        return (delay.days ?? 0) * 24 * 60 * 60 * 1000
            + (delay.hours ?? 0) * 60 * 60 * 1000
            + (delay.minutes ?? 0) * 60 * 1000
            + (delay.seconds ?? 0) * 1000
            + (delay.milliseconds ?? 0)
    }

    async publish({
                      exchange,
                      routingKey,
                      data,
                      options
                  }: IRabbitMqMessage): Promise<void> {
        const connection = await this.connectionFactory.getConnection()
        const confirmChannel = await connection.createConfirmChannel()
        try {
            const enqueued = confirmChannel.publish(
                exchange,
                routingKey,
                new Buffer(this.serializer.serialize(data)),
                options
            )

            if (!enqueued) {
                throw new Error('Failed to publish message')
            }

            await confirmChannel.waitForConfirms()
        } finally {
            await confirmChannel.close()
        }
    }

    async schedule({
                       exchange,
                       routingKey,
                       data,
                       options,
                       delay,
                   }: IRabbitMqScheduledMessage): Promise<void> {
        const connection = await this.connectionFactory.getConnection()
        const channel = await connection.createChannel()
        try {
            await channel.checkQueue(routingKey)
            const schedulerQueue = `${routingKey}.scheduler`
            await channel.assertQueue(schedulerQueue, {
                durable: true,
                deadLetterExchange: '',
                deadLetterRoutingKey: routingKey,
                autoDelete: true
            })
            const delayInMilliseconds = RabbitMqPublisher.calculateDelayInMilliseconds(delay)
            await this.publish({
                exchange,
                routingKey: schedulerQueue,
                data,
                options: {
                    ...options,
                    persistent: true,
                    expiration: delayInMilliseconds
                }
            })
        } finally {
            await channel.close()
        }
    }
}