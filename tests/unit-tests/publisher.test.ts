import { RabbitMqPublisher } from '../../src/publisher'
import { IRabbitMqConnectionFactory } from '../../src/extensions'
import { Channel, ConfirmChannel, Connection } from 'amqplib'
import { IRabbitMqLogger, IRabbitMqSerializer, PublishFailedError } from '../../src'
import { randomUUID } from 'node:crypto'
import fn = jest.fn
import Mocked = jest.Mocked
import mocked = jest.mocked

describe('Publisher', () => {
  let channel: Partial<Channel>
  let confirmChannel: Partial<ConfirmChannel>
  let connection: Partial<Connection>
  let connectionFactory: Mocked<IRabbitMqConnectionFactory>
  let serializer: Mocked<IRabbitMqSerializer>
  let publisher: RabbitMqPublisher
  let logger: Mocked<IRabbitMqLogger>

  beforeEach(() => {
    confirmChannel = {
      assertQueue: fn().mockReturnValue(Promise.resolve({})),
      assertExchange: fn().mockReturnValue(Promise.resolve()),
      publish: fn().mockReturnValue(true),
      waitForConfirms: fn().mockReturnValue(Promise.resolve()),
    }
    channel = {
      assertQueue: fn().mockReturnValue(Promise.resolve({})),
    }
    connection = {
      createChannel: fn().mockReturnValue(channel),
      createConfirmChannel: fn().mockReturnValue(confirmChannel),
    }
    connectionFactory = {
      getConnection: fn().mockReturnValue(connection),
    }
    serializer = {
      serialize: fn().mockReturnValue('hello world'),
      deserialize: fn(),
    }
    logger = {
      traceId: mocked<string>(randomUUID()),
      setTraceId: fn(),
      error: fn(),
    }
    publisher = new RabbitMqPublisher(connectionFactory, serializer, logger)
  })

  it('should publish message', async () => {
    confirmChannel.publish = fn().mockReturnValue(true)

    const isPublished = await publisher.publish({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
    })

    expect(isPublished).toBeTruthy()
    expect(confirmChannel.publish).toHaveBeenCalledWith(
      'exchange',
      'routing-key',
      expect.anything(),
      expect.anything())
  })

  it('should assert exchange', async () => {
    await publisher.publish({
      exchange: {
        name: 'exchange',
        options: {
          type: 'direct',
          assert: true,
          durable: true,
        },
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
    })

    expect(confirmChannel.assertExchange).toHaveBeenCalledWith(
      'exchange',
      'direct',
      expect.objectContaining({
        durable: true,
      }),
    )
  })

  it('should assert exchange only once', async () => {
    await publisher.publish({
      exchange: {
        name: 'exchange',
        options: {
          type: 'direct',
          assert: true,
          durable: true,
        },
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
    })

    await publisher.publish({
      exchange: {
        name: 'exchange',
        options: {
          type: 'direct',
          assert: true,
          durable: true,
        },
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
    })

    expect(confirmChannel.assertExchange).toHaveBeenCalledTimes(1)
  })

  it('should assert queue', async () => {
    await publisher.publish({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
      queue: {
        name: 'queue',
        options: {
          durable: true,
          assert: true,
        },
      },
    })

    expect(confirmChannel.assertQueue).toHaveBeenCalledWith(
      'queue',
      expect.objectContaining({
        durable: true,
      }),
    )
  })

  it('should assert queue only once', async () => {
    await publisher.publish({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
      queue: {
        name: 'queue',
        options: {
          durable: true,
          assert: true,
        },
      },
    })

    await publisher.publish({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
      queue: {
        name: 'queue',
        options: {
          durable: true,
          assert: true,
        },
      },
    })

    expect(confirmChannel.assertQueue).toHaveBeenCalledTimes(1)
  })

  it('should log error when publish fail', async () => {
    confirmChannel.publish = fn().mockReturnValue(false)

    const isPublished = await publisher.publish({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
    })

    expect(isPublished).toBeFalsy()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to publish message',
        error: expect.any(PublishFailedError),
      }),
    )
  })

  it('should log error when throw', async () => {
    confirmChannel.publish = fn().mockImplementation(() => {
      throw new Error('error')
    })

    const isPublished = await publisher.publish({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'routing-key',
      data: {
        message: 'hello world',
      },
    })

    expect(isPublished).toBeFalsy()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to publish message',
        error: expect.any(Error),
      }),
    )
  })

  it('should assert queue when schedule', async () => {
    await publisher.schedule({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'queue',
      data: {
        message: 'hello world',
      },
      queue: {
        name: 'queue',
        options: {
          durable: true,
          assert: true,
        },
      },
      delay: {
        seconds: 2,
      },
    })

    expect(channel.assertQueue).toHaveBeenCalledWith(
      'queue',
      expect.objectContaining({
        durable: true,
      }),
    )

    expect(confirmChannel.assertQueue).toHaveBeenCalledWith(
      'queue.scheduler',
      expect.objectContaining({
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: 'queue',
      }),
    )
  })

  it('should assert queue only once when schedule', async () => {
    await publisher.schedule({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'queue',
      data: {
        message: 'hello world',
      },
      queue: {
        name: 'queue',
        options: {
          durable: true,
          assert: true,
        },
      },
      delay: {
        seconds: 2,
      },
    })

    await publisher.schedule({
      exchange: {
        name: 'exchange',
      },
      routingKey: 'queue',
      data: {
        message: 'hello world',
      },
      queue: {
        name: 'queue',
        options: {
          durable: true,
          assert: true,
        },
      },
      delay: {
        seconds: 2,
      },
    })

    expect(channel.assertQueue).toHaveBeenCalledTimes(1)
    expect(confirmChannel.assertQueue).toHaveBeenCalledTimes(1)
  })

  it('should fail when queue and routing-key are different', () => {
    expect(async () => await publisher.schedule({
        exchange: {
          name: 'exchange',
        },
        routingKey: 'different-queue',
        data: {
          message: 'hello world',
        },
        queue: {
          name: 'queue',
          options: {
            durable: true,
            assert: true,
          },
        },
        delay: {
          seconds: 2,
        },
      }),
    ).rejects.toThrow(expect.any(PublishFailedError))
  })
})