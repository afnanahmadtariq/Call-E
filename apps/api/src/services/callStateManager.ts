import { redisConnection } from '../lib/redis';

const CALL_STATE_PREFIX = 'call-state:';
const CALL_STATE_TTL = 30 * 60; // 30 minutes

export interface CallState {
    appointmentId: number;
    twilioCallSid: string;
    elevenLabsSessionId?: string;
    status: 'INITIATED' | 'CONNECTED' | 'NEGOTIATING' | 'CONFIRMED' | 'FAILED' | 'ENDED';
    lastAudioTs?: number;
    transcript?: string;
}

/**
 * Store call state in Redis
 */
export async function setCallState(callSid: string, state: CallState): Promise<void> {
    const key = `${CALL_STATE_PREFIX}${callSid}`;
    await redisConnection.setex(key, CALL_STATE_TTL, JSON.stringify(state));
}

/**
 * Get call state from Redis
 */
export async function getCallState(callSid: string): Promise<CallState | null> {
    const key = `${CALL_STATE_PREFIX}${callSid}`;
    const data = await redisConnection.get(key);
    return data ? JSON.parse(data) : null;
}

/**
 * Update specific fields of call state
 */
export async function updateCallState(callSid: string, updates: Partial<CallState>): Promise<void> {
    const current = await getCallState(callSid);
    if (current) {
        await setCallState(callSid, { ...current, ...updates });
    }
}

/**
 * Delete call state (cleanup after call ends)
 */
export async function deleteCallState(callSid: string): Promise<void> {
    const key = `${CALL_STATE_PREFIX}${callSid}`;
    await redisConnection.del(key);
}

/**
 * Map appointment ID to call SID for reverse lookup
 */
export async function mapAppointmentToCall(appointmentId: number, callSid: string): Promise<void> {
    const key = `appointment-call:${appointmentId}`;
    await redisConnection.setex(key, CALL_STATE_TTL, callSid);
}

/**
 * Get call SID from appointment ID
 */
export async function getCallSidByAppointment(appointmentId: number): Promise<string | null> {
    const key = `appointment-call:${appointmentId}`;
    return await redisConnection.get(key);
}
