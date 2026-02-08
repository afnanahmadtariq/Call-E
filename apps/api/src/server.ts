import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { appointmentRoutes } from './routes/appointments';
import { initOutboundCallsWorker, OutboundCallJobData } from './jobs/callQueue';
import { prisma } from './lib/prisma';
import { Job } from 'bullmq';

dotenv.config();

const fastify = Fastify({ logger: true });

// Register plugins
fastify.register(cors, {
    origin: true, // Allow all origins for MVP (restrict in production)
});
fastify.register(websocket);

// Register routes
fastify.register(appointmentRoutes);

// Health check endpoint
fastify.get('/ping', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/health', async () => {
    return { status: 'healthy', uptime: process.uptime() };
});

// Worker job processor (placeholder - will be expanded with Twilio integration)
async function processOutboundCall(job: Job<OutboundCallJobData>): Promise<void> {
    const { appointmentId, providerPhone, providerName, serviceType } = job.data;

    fastify.log.info(`📞 Processing call for appointment ${appointmentId} to ${providerName} (${providerPhone})`);

    try {
        // Update status to CALLING
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'CALLING' },
        });

        // TODO: Implement actual Twilio call here
        // For now, simulate a successful call after 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Simulate success (will be replaced with real call logic)
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: 'CONFIRMED',
                resultPayload: {
                    providerName,
                    confirmedDate: new Date().toISOString(),
                    confirmedTime: '10:00 AM',
                    message: `Appointment confirmed with ${providerName}`,
                },
            },
        });

        // Create call log
        await prisma.callLog.create({
            data: {
                appointmentId,
                twilioCallSid: `SIMULATED-${Date.now()}`,
                status: 'COMPLETED',
                startedAt: new Date(),
                endedAt: new Date(),
                transcript: `[Simulated] Called ${providerName} for ${serviceType}. Appointment confirmed.`,
            },
        });

        fastify.log.info(`✅ Call completed for appointment ${appointmentId}`);
    } catch (error) {
        fastify.log.error(`❌ Call failed for appointment ${appointmentId}: ${error}`);

        await prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: 'FAILED',
                resultPayload: { error: 'Call failed' },
            },
        });

        throw error; // Re-throw to trigger BullMQ retry
    }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}. Shutting down gracefully...`);
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3001');

        // Initialize the worker
        initOutboundCallsWorker(processOutboundCall);
        fastify.log.info('📋 BullMQ worker initialized');

        await fastify.listen({ port, host: '0.0.0.0' });
        fastify.log.info(`🚀 Server listening on http://localhost:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
