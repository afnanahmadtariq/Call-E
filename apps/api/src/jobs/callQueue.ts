import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis';

// Queue for outbound calls
export const outboundCallsQueue = new Queue('outbound-calls', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds initial delay
        },
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});

// Job payload interface
export interface OutboundCallJobData {
    appointmentId: number;
    providerPhone: string;
    providerName: string;
    serviceType: string;
    preferredTimeWindow: string | null;
}

// Initialize worker (processes jobs)
export function initOutboundCallsWorker(
    processJob: (job: Job<OutboundCallJobData>) => Promise<void>
) {
    const worker = new Worker<OutboundCallJobData>(
        'outbound-calls',
        processJob,
        {
            connection: redisConnection,
            concurrency: 1, // Process one call at a time for MVP
        }
    );

    worker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} completed for appointment ${job.data.appointmentId}`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    return worker;
}
