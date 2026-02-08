import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import websocket from '@fastify/websocket';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

// Register WebSocket plugin
fastify.register(websocket);

// Basic health check
fastify.get('/ping', async (request, reply) => {
    return { status: 'ok' };
});

// Placeholder for routes, services, cron jobs
// TODO: Add routes specific to Call-E

const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log('Server listening on http://localhost:3001');

        // Example cron job (placeholder)
        cron.schedule('* * * * *', () => {
            console.log('Cron job running every minute');
        });

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
