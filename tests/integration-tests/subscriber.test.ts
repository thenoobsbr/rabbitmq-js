import { GenericContainer, StartedTestContainer } from 'testcontainers'
import { IRabbitMqRetryBehavior, IRabbitMqSerializer, RabbitMqConnection } from '../../src'
import { randomUUID } from 'node:crypto'
import { Task } from '../../src/extensions'
import fn = jest.fn
import Mocked = jest.Mocked

describe('Subscriber', () => {
  let rabbitmq: StartedTestContainer
  let connection: RabbitMqConnection
  let serializer: IRabbitMqSerializer

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
  })

  afterAll(async () => {
    await connection?.close()
    await rabbitmq?.stop()
  })

  it('should subscribe', async () => {
    const queue = randomUUID().toString()
    const callback = fn().mockReturnValue(Promise.resolve())
    const subscription = connection.subscribe({
      type: Object,
      prefetch: 1,
      queue: {
        name: queue,
        options: {
          durable: true,
          assert: true,
        },
      },
      callback: callback,
    })
    await subscription.start()
    try {
      const publisher = connection.getPublisher()
      const isPublished = await publisher.publish({
        exchange: {
          name: '',
        },
        routingKey: queue,
        data: {
          message: 'hello world',
        },
        options: {
          persistent: true,
        },
      })

      expect(isPublished).toBeTruthy()
      expect(callback)
        .toBeCalledWith(expect.objectContaining({ attempt: 1, data: { message: 'hello world' } }))
    } finally {
      await subscription.stop()
    }
  })

  it('should recover from a connection issue', async () => {
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

      const queue = randomUUID().toString()
      const callback = fn().mockReturnValue(Promise.resolve())
      const subscription = connection.subscribe({
        type: Object,
        prefetch: 1,
        queue: {
          name: queue,
          options: {
            durable: true,
            assert: true,
          },
        },
        callback: callback,
      })
      await subscription.start()
      try {
        const publisher = connection.getPublisher()
        let isPublished = await publisher.publish({
          exchange: {
            name: '',
          },
          routingKey: queue,
          data: {
            message: 'hello world',
          },
          options: {
            persistent: true,
          },
        })

        expect(isPublished).toBeTruthy()
        expect(callback)
          .toBeCalledWith(expect.objectContaining({ attempt: 1, data: { message: 'hello world' } }))

        await temporaryRabbitMq.restart()

        isPublished = await publisher.publish({
          exchange: {
            name: '',
          },
          routingKey: queue,
          data: {
            message: 'hello world',
          },
          options: {
            persistent: true,
          },
        })

        expect(isPublished).toBeTruthy()
        expect(callback)
          .toBeCalledWith(expect.objectContaining({ attempt: 1, data: { message: 'hello world' } }))
      } finally {
        await subscription.stop()
      }
    } finally {
      await temporaryRabbitMq.stop()
    }
  })

  it('should send to dlq when fails and no retry is configured', async () => {
    const queue = randomUUID().toString()
    const callback = fn().mockImplementation(() => Promise.reject(new Error('failed')))
    const subscription = connection.subscribe({
      type: Object,
      prefetch: 1,
      queue: {
        name: queue,
        options: {
          durable: true,
          assert: true,
        },
      },
      callback: callback,
    })
    await subscription.start()
    try {
      const publisher = connection.getPublisher()
      const isPublished = await publisher.publish({
        exchange: {
          name: '',
        },
        routingKey: queue,
        data: {
          message: 'hello world',
        },
        options: {
          persistent: true,
        },
      })

      expect(isPublished).toBeTruthy()
      expect(callback)
        .toBeCalledWith(expect.objectContaining({ attempt: 1, data: { message: 'hello world' } }))

      await Task.delay({ seconds: 1 })

      const amqpConnection = await connection.getConnection()
      const channel = await amqpConnection.createChannel()
      const dlq = await channel.checkQueue(`${queue}.dlq`)
      expect(dlq).not.toBeNull()
      expect(dlq.messageCount).toBe(1)
    } finally {
      await subscription.stop()
    }
  })

  it('should retry when fails and retry is configured and can retry', async () => {
    const retryBehavior: Mocked<IRabbitMqRetryBehavior> = {
      canRetry: fn().mockReturnValueOnce(true),
      getDelay: fn().mockReturnValue({ seconds: 4 }),
    }
    const queue = randomUUID().toString()
    const callback = fn().mockImplementation(() => Promise.reject(new Error('failed')))
    const subscription = connection.subscribe({
      type: Object,
      prefetch: 1,
      queue: {
        name: queue,
        options: {
          durable: true,
          assert: true,
        },
      },
      retryBehavior: retryBehavior,
      callback: callback,
    })
    await subscription.start()
    try {
      const publisher = connection.getPublisher()
      const isPublished = await publisher.publish({
        exchange: {
          name: '',
        },
        routingKey: queue,
        data: {
          message: 'hello world',
        },
        options: {
          persistent: true,
        },
      })

      expect(isPublished).toBeTruthy()

      await Task.delay({ seconds: 2 })

      expect(retryBehavior.canRetry).toHaveBeenCalledWith(1)

      const amqpConnection = await connection.getConnection()
      const channel = await amqpConnection.createChannel()
      const scheduler = await channel.checkQueue(`${queue}.scheduler`)
      expect(scheduler).not.toBeNull()
      expect(scheduler.messageCount).toBe(1)

      await Task.delay({ seconds: 4 })

      expect(callback).toHaveBeenCalledTimes(2)
    } finally {
      await subscription.stop()
    }
  })

  it('should send to dlq when fails and retry is configured but cannot retry', async () => {
    const retryBehavior: Mocked<IRabbitMqRetryBehavior> = {
      canRetry: fn().mockReturnValueOnce(false),
      getDelay: fn(),
    }
    const queue = randomUUID().toString()
    const callback = fn().mockImplementation(() => Promise.reject(new Error('failed')))
    const subscription = connection.subscribe({
      type: Object,
      prefetch: 1,
      queue: {
        name: queue,
        options: {
          durable: true,
          assert: true,
        },
      },
      retryBehavior: retryBehavior,
      callback: callback,
    })
    await subscription.start()
    try {
      const publisher = connection.getPublisher()
      const isPublished = await publisher.publish({
        exchange: {
          name: '',
        },
        routingKey: queue,
        data: {
          message: 'hello world',
        },
        options: {
          persistent: true,
        },
      })

      expect(isPublished).toBeTruthy()

      await Task.delay({ seconds: 2 })

      expect(retryBehavior.canRetry).toHaveBeenCalledWith(1)

      const amqpConnection = await connection.getConnection()
      const channel = await amqpConnection.createChannel()
      const scheduler = await channel.checkQueue(`${queue}.dlq`)
      expect(scheduler).not.toBeNull()
      expect(scheduler.messageCount).toBe(1)
    } finally {
      await subscription.stop()
    }
  })
})