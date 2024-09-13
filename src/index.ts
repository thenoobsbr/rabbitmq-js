import {RabbitMqConnection} from "./rabbitmq-connection"
import {IRabbitMqConnection} from "./types";

const connection: IRabbitMqConnection = new RabbitMqConnection({
    connectionString: 'amqp://guest:guest@localhost:5672',
    appName: 'test-app'
}, {
    serialize: JSON.stringify,
    deserialize: JSON.parse
})

const publisher = connection.getPublisher()
publisher.schedule({
    exchange: '',
    routingKey: 'test',
    data: {
        test: 'test'
    },
    delay: {
        seconds: 30
    }
}).then(_ => console.log('done'))
    .catch(err => console.log(err.toString()))



