'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AppointmentResult {
  id: number;
  status: string;
  message?: string;
}

interface AppointmentStatus {
  id: number;
  status: string;
  updatedAt: string;
}

interface AppointmentFinalResult {
  id: number;
  status: string;
  result: {
    providerName?: string;
    confirmedDate?: string;
    confirmedTime?: string;
    message?: string;
    error?: string;
  } | null;
  callLog: {
    startedAt: string;
    endedAt: string;
    transcript: string;
    error: string | null;
  } | null;
}

type ViewState = 'form' | 'executing' | 'result';

export default function Home() {
  // Form state
  const [serviceType, setServiceType] = useState('');
  const [preferredDateFrom, setPreferredDateFrom] = useState('');
  const [preferredDateTo, setPreferredDateTo] = useState('');
  const [preferredTimeWindow, setPreferredTimeWindow] = useState('anytime');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('flexible');

  // UI state
  const [viewState, setViewState] = useState<ViewState>('form');
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [finalResult, setFinalResult] = useState<AppointmentFinalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          preferredDateFrom: preferredDateFrom || undefined,
          preferredDateTo: preferredDateTo || undefined,
          preferredTimeWindow,
          location: location || undefined,
          urgency,
        }),
      });

      const data: AppointmentResult = await response.json();

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || 'Failed to create appointment');
      }

      setAppointmentId(data.id);
      setCurrentStatus(data.status);
      setViewState('executing');

      // Start polling for status
      pollStatus(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll for status updates
  const pollStatus = async (id: number) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/appointments/${id}/status`);
        const data: AppointmentStatus = await response.json();

        setCurrentStatus(data.status);

        // If terminal state, stop polling and fetch final result
        if (['CONFIRMED', 'FAILED'].includes(data.status)) {
          clearInterval(pollInterval);
          await fetchFinalResult(id);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Fetch final result
  const fetchFinalResult = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/appointments/${id}/result`);
      const data: AppointmentFinalResult = await response.json();
      setFinalResult(data);
      setViewState('result');
    } catch (err) {
      setError('Failed to fetch result');
    }
  };

  // Reset to start over
  const handleReset = () => {
    setServiceType('');
    setPreferredDateFrom('');
    setPreferredDateTo('');
    setPreferredTimeWindow('anytime');
    setLocation('');
    setUrgency('flexible');
    setViewState('form');
    setAppointmentId(null);
    setCurrentStatus('');
    setFinalResult(null);
    setError(null);
  };

  // Status indicator component
  const StatusIndicator = ({ status }: { status: string }) => {
    const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
      PENDING: { color: 'bg-yellow-500', label: 'Pending', icon: '⏳' },
      CALLING: { color: 'bg-blue-500 animate-pulse', label: 'Calling Provider...', icon: '📞' },
      NEGOTIATING: { color: 'bg-purple-500 animate-pulse', label: 'Negotiating...', icon: '🤝' },
      CONFIRMED: { color: 'bg-green-500', label: 'Confirmed!', icon: '✅' },
      FAILED: { color: 'bg-red-500', label: 'Failed', icon: '❌' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-500', label: status, icon: '❓' };

    return (
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full ${config.color}`} />
        <span className="text-xl font-medium">{config.icon} {config.label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Call-E
          </h1>
          <p className="text-[var(--muted)]">AI-Powered Appointment Booking</p>
        </div>

        {/* Form View */}
        {viewState === 'form' && (
          <form onSubmit={handleSubmit} className="bg-[var(--card)] rounded-2xl p-8 shadow-xl border border-[var(--border)] animate-fade-in">
            <h2 className="text-xl font-semibold mb-6">Book an Appointment</h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            {/* Service Type */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Service Type *
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                required
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              >
                <option value="">Select a service...</option>
                <option value="dentist">🦷 Dentist</option>
                <option value="salon">💇 Hair Salon</option>
                <option value="plumber">🔧 Plumber</option>
                <option value="optometrist">👁️ Optometrist</option>
                <option value="mechanic">🚗 Auto Mechanic</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={preferredDateFrom}
                  onChange={(e) => setPreferredDateFrom(e.target.value)}
                  className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={preferredDateTo}
                  onChange={(e) => setPreferredDateTo(e.target.value)}
                  className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            {/* Time Window */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Preferred Time
              </label>
              <div className="flex gap-3">
                {['morning', 'afternoon', 'anytime'].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setPreferredTimeWindow(time)}
                    className={`flex-1 py-2 px-4 rounded-lg border transition ${preferredTimeWindow === time
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'bg-[var(--secondary)] border-[var(--border)] hover:border-indigo-400'
                      }`}
                  >
                    {time.charAt(0).toUpperCase() + time.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or ZIP code"
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            {/* Urgency */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                Urgency
              </label>
              <div className="flex gap-3">
                {['ASAP', 'flexible'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`flex-1 py-2 px-4 rounded-lg border transition ${urgency === u
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'bg-[var(--secondary)] border-[var(--border)] hover:border-indigo-400'
                      }`}
                  >
                    {u === 'ASAP' ? '🔥 ASAP' : '📅 Flexible'}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !serviceType}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : '📞 Book Now'}
            </button>
          </form>
        )}

        {/* Execution View */}
        {viewState === 'executing' && (
          <div className="bg-[var(--card)] rounded-2xl p-8 shadow-xl border border-[var(--border)] text-center animate-fade-in">
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse-glow">
                <span className="text-5xl">📞</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4">Calling Provider...</h2>
            <p className="text-[var(--muted)] mb-8">
              Our AI agent is negotiating your appointment
            </p>

            <div className="flex justify-center mb-6">
              <StatusIndicator status={currentStatus} />
            </div>

            <p className="text-sm text-[var(--muted)]">
              Appointment ID: #{appointmentId}
            </p>
          </div>
        )}

        {/* Result View */}
        {viewState === 'result' && finalResult && (
          <div className="bg-[var(--card)] rounded-2xl p-8 shadow-xl border border-[var(--border)] animate-fade-in">
            <div className="text-center mb-6">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${finalResult.status === 'CONFIRMED'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
                }`}>
                <span className="text-4xl">
                  {finalResult.status === 'CONFIRMED' ? '✅' : '❌'}
                </span>
              </div>
              <h2 className="text-2xl font-bold">
                {finalResult.status === 'CONFIRMED' ? 'Appointment Confirmed!' : 'Booking Failed'}
              </h2>
            </div>

            {finalResult.status === 'CONFIRMED' && finalResult.result && (
              <div className="bg-[var(--secondary)] rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[var(--muted)]">Provider</p>
                    <p className="font-semibold">{finalResult.result.providerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Date</p>
                    <p className="font-semibold">
                      {finalResult.result.confirmedDate
                        ? new Date(finalResult.result.confirmedDate).toLocaleDateString()
                        : 'TBD'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--muted)]">Time</p>
                    <p className="font-semibold">{finalResult.result.confirmedTime}</p>
                  </div>
                </div>
              </div>
            )}

            {finalResult.status === 'FAILED' && finalResult.result?.error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6">
                {finalResult.result.error}
              </div>
            )}

            {finalResult.callLog?.transcript && (
              <details className="mb-6">
                <summary className="cursor-pointer text-sm text-[var(--muted)] hover:text-white">
                  View Call Summary
                </summary>
                <div className="mt-3 bg-[var(--secondary)] rounded-lg p-4 text-sm">
                  {finalResult.callLog.transcript}
                </div>
              </details>
            )}

            <button
              onClick={handleReset}
              className="w-full bg-[var(--secondary)] hover:bg-[var(--border)] text-white font-semibold py-4 rounded-xl transition"
            >
              Book Another Appointment
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
