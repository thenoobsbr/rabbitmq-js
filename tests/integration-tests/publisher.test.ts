import { IRabbitMqPublisher, IRabbitMqSerializer, RabbitMqConnection } from '../../src'
import { randomUUID } from 'node:crypto'
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import { Task } from '../../src/extensions'

describe('RabbitMqPublisher', () => {
  let rabbitmq: StartedTestContainer
  let connection: RabbitMqConnection
  let serializer: IRabbitMqSerializer
  let publisher: IRabbitMqPublisher

  beforeAll(async () => {
    rabbitmq = await new GenericContainer('rabbitmq:alpine')
      .withExposedPorts(5672)
      .start()

    serializer = {
      serialize: (data: any) => JSON.stringify(data),
      deserialize: (_: any, data: any) => JSON.parse(data),
    }
    connection = new RabbitMqConnection({
      connectionString: `amqp://guest:guest@localhost:${rabbitmq.getFirstMappedPort()}/`,
      appName: 'integration-test-app',
    }, serializer)
    publisher = connection.getPublisher()
  })

  afterAll(async () => {
    await connection?.close()
    await rabbitmq?.stop()
  })

  it('should publish message', async () => {
    const amqpConnection = await connection.getConnection()
    const channel = await amqpConnection.createChannel()
    try {
      const queue = randomUUID()
      await channel.assertQueue(queue, { durable: true })

      const result = await publisher.publish({
        exchange: {
          name: '',
        },
        routingKey: queue,
        data: {
          message: 'hello world',
        },
      })
      expect(result).toBeTruthy()

      const message: any = await channel.get(queue, {})
      expect(message).not.toBeNull()
      const data = serializer.deserialize<any>(Object, message.content.toString())
      expect(data.message).toBe('hello world')
    } finally {
      await channel.close()
    }
  })

  it('should schedule message', async () => {
    const amqpConnection = await connection.getConnection()
    const channel = await amqpConnection.createChannel()
    try {
      const queue = randomUUID()
      await publisher.schedule({
        exchange: {
          name: '',
        },
        queue: {
          name: queue,
          options: {
            durable: true,
            assert: true,
          },
        },
        routingKey: queue,
        data: {
          message: 'hello world',
        },
        options: {
          persistent: true,
        },
        delay: {
          seconds: 2,
        },
      })

      let queueStatus = await channel.checkQueue(queue)
      expect(queueStatus).not.toBeNull()
      expect(queueStatus.messageCount).toBe(0)

      await Task.delay({ seconds: 2 })

      queueStatus = await channel.checkQueue(queue)
      expect(queueStatus).not.toBeNull()
      expect(queueStatus.messageCount).toBe(1)
    } finally {
      await channel.close()
    }
  })

  it('should recover connection', async () => {
    const temporaryRabbitMq = await new GenericContainer('rabbitmq:alpine')
      .withExposedPorts({
        container: 5672,
        host: 32799,
      }).start()
    try {
      const connection = new RabbitMqConnection({
        connectionString: `amqp://guest:guest@localhost:${temporaryRabbitMq.getFirstMappedPort()}/`,
        appName: 'integration-test-app-recovery',
      }, serializer)
      const publisher = connection.getPublisher()

      const queue = randomUUID()
      let isPublished = await publisher.publish({
        routingKey: queue,
        data: {
          message: 'hello world',
        },
        exchange: {
          name: '',
        },
        queue: {
          name: queue,
          options: {
            durable: true,
            assert: true,
          },
        },
      })
      expect(isPublished).toBeTruthy()
      await temporaryRabbitMq.restart()

      isPublished = await publisher.publish({
        routingKey: queue,
        data: {
          message: 'hello world',
        },
        exchange: {
          name: '',
        },
        queue: {
          name: queue,
          options: {
            durable: true,
            assert: true,
          },
        },
      })

      expect(isPublished).toBeTruthy()
    } finally {
      await temporaryRabbitMq.stop()
    }
  })
})