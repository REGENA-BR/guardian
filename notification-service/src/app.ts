import { ApplicationState, COMMON_CONNECTION_CONFIG, DataBaseHelper, Logger, MessageBrokerChannel, Migration, } from '@guardian/common';
import { ApplicationStates } from '@guardian/interfaces';
import { MikroORM } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import process from 'process';
import { AppModule } from './app.module.js';
import { DEFAULT_MONGO } from '#constants';

Promise.all([
    Migration({
        ...COMMON_CONNECTION_CONFIG,
        migrations: {
            path: 'dist/migrations',
            transactional: false,
        },
    }),
    MikroORM.init<MongoDriver>({
        ...COMMON_CONNECTION_CONFIG,
        driverOptions: {
            useUnifiedTopology: true,
            minPoolSize: parseInt(process.env.MIN_POOL_SIZE ?? DEFAULT_MONGO.MIN_POOL_SIZE, 10),
            maxPoolSize: parseInt(process.env.MAX_POOL_SIZE  ?? DEFAULT_MONGO.MAX_POOL_SIZE, 10),
            maxIdleTimeMS: parseInt(process.env.MAX_IDLE_TIME_MS  ?? DEFAULT_MONGO.MAX_IDLE_TIME_MS, 10)
        },
        ensureIndexes: true,
    }),
    MessageBrokerChannel.connect('NOTIFICATION_SERVICE'),
    NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
        transport: Transport.NATS,
        options: {
            queue: 'notification-service',
            name: `${process.env.SERVICE_CHANNEL}`,
            servers: [`nats://${process.env.MQ_ADDRESS}:4222`],
        },
    }),
]).then(
    async (values) => {
        const [_, db, mqConnection, app] = values;
        DataBaseHelper.orm = db;

        app.listen();

        new Logger().setConnection(mqConnection);

        const state = new ApplicationState();
        await state
            .setServiceName('NOTIFICATION_SERVICE')
            .setConnection(mqConnection)
            .init();
        state.updateState(ApplicationStates.STARTED);
        state.updateState(ApplicationStates.INITIALIZING);
        state.updateState(ApplicationStates.READY);
        await new Logger().info('notification service started', ['NOTIFICATION_SERVICE']);
    },
    (reason) => {
        console.log(reason);
        process.exit(0);
    }
);
