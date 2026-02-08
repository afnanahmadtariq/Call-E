import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { outboundCallsQueue } from '../jobs/callQueue';

// Request body types
interface CreateAppointmentBody {
    serviceType: string;
    preferredDateFrom?: string;
    preferredDateTo?: string;
    preferredTimeWindow?: string;
    location?: string;
    urgency?: string;
}

interface AppointmentParams {
    id: string;
}

export async function appointmentRoutes(fastify: FastifyInstance) {

    // POST /appointments - Create a new appointment request
    fastify.post<{ Body: CreateAppointmentBody }>(
        '/appointments',
        async (request: FastifyRequest<{ Body: CreateAppointmentBody }>, reply: FastifyReply) => {
            const { serviceType, preferredDateFrom, preferredDateTo, preferredTimeWindow, location, urgency } = request.body;

            // Validate required fields
            if (!serviceType) {
                return reply.status(400).send({ error: 'serviceType is required' });
            }

            try {
                // 1. Create appointment in database
                const appointment = await prisma.appointment.create({
                    data: {
                        serviceType,
                        preferredDateFrom: preferredDateFrom ? new Date(preferredDateFrom) : null,
                        preferredDateTo: preferredDateTo ? new Date(preferredDateTo) : null,
                        preferredTimeWindow: preferredTimeWindow || null,
                        location: location || null,
                        urgency: urgency || 'flexible',
                        status: 'PENDING',
                    },
                });

                // 2. Find a provider for this service type (MVP: just pick the first one)
                const provider = await prisma.provider.findFirst({
                    where: {
                        serviceType: {
                            contains: serviceType,
                            mode: 'insensitive',
                        },
                    },
                });

                if (!provider) {
                    // No provider found - update status and return
                    await prisma.appointment.update({
                        where: { id: appointment.id },
                        data: { status: 'FAILED', resultPayload: { error: 'No provider found for this service type' } },
                    });
                    return reply.status(200).send({
                        id: appointment.id,
                        status: 'FAILED',
                        message: 'No provider found for this service type',
                    });
                }

                // 3. Enqueue job for outbound call
                await outboundCallsQueue.add(
                    `call-${appointment.id}`,
                    {
                        appointmentId: appointment.id,
                        providerPhone: provider.phone,
                        providerName: provider.name,
                        serviceType,
                        preferredTimeWindow: preferredTimeWindow || null,
                    },
                    {
                        delay: 0, // Start immediately for MVP
                    }
                );

                return reply.status(201).send({
                    id: appointment.id,
                    status: 'PENDING',
                    message: 'Appointment request created. Call will be placed shortly.',
                });
            } catch (error) {
                fastify.log.error(error);
                return reply.status(500).send({ error: 'Failed to create appointment' });
            }
        }
    );

    // GET /appointments/:id/status - Check appointment status
    fastify.get<{ Params: AppointmentParams }>(
        '/appointments/:id/status',
        async (request: FastifyRequest<{ Params: AppointmentParams }>, reply: FastifyReply) => {
            const { id } = request.params;

            try {
                const appointment = await prisma.appointment.findUnique({
                    where: { id: parseInt(id) },
                    select: {
                        id: true,
                        status: true,
                        updatedAt: true,
                    },
                });

                if (!appointment) {
                    return reply.status(404).send({ error: 'Appointment not found' });
                }

                return reply.send(appointment);
            } catch (error) {
                fastify.log.error(error);
                return reply.status(500).send({ error: 'Failed to fetch status' });
            }
        }
    );

    // GET /appointments/:id/result - Get final result
    fastify.get<{ Params: AppointmentParams }>(
        '/appointments/:id/result',
        async (request: FastifyRequest<{ Params: AppointmentParams }>, reply: FastifyReply) => {
            const { id } = request.params;

            try {
                const appointment = await prisma.appointment.findUnique({
                    where: { id: parseInt(id) },
                    include: {
                        callLog: true,
                    },
                });

                if (!appointment) {
                    return reply.status(404).send({ error: 'Appointment not found' });
                }

                return reply.send({
                    id: appointment.id,
                    status: appointment.status,
                    result: appointment.resultPayload,
                    callLog: appointment.callLog
                        ? {
                            startedAt: appointment.callLog.startedAt,
                            endedAt: appointment.callLog.endedAt,
                            transcript: appointment.callLog.transcript,
                            error: appointment.callLog.error,
                        }
                        : null,
                });
            } catch (error) {
                fastify.log.error(error);
                return reply.status(500).send({ error: 'Failed to fetch result' });
            }
        }
    );
}
