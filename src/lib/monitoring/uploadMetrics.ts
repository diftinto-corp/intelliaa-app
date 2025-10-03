/**
 * INTEL-005: Upload Performance Monitoring
 *
 * Tracks upload metrics for monitoring and alerting.
 * Logs to console in development, sends to monitoring service in production.
 */

export interface UploadMetrics {
  documentStorageId: string;
  accountId: string;
  fileName: string;
  fileSize: number;
  chunkCount: number;
  totalDuration: number;
  embeddingDuration: number;
  pineconeUploadDuration: number;
  vapiUploadDuration: number;
  databaseDuration: number;
  success: boolean;
  errorStep?: string;
  errorMessage?: string;
  wasRenamed: boolean;
}

/**
 * Track upload metrics
 *
 * In production, this should send data to a monitoring service like:
 * - Vercel Analytics
 * - PostHog
 * - DataDog
 * - Custom analytics endpoint
 */
export async function trackUploadMetrics(metrics: UploadMetrics): Promise<void> {
  // Development: Log to console
  if (process.env.NODE_ENV === 'development') {
    console.log('[UploadMetrics]', {
      ...metrics,
      avgChunkProcessingTime: metrics.embeddingDuration / metrics.chunkCount,
      uploadSpeedMBps: (metrics.fileSize / 1024 / 1024) / (metrics.totalDuration / 1000),
    });
  }

  // Production: Send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    try {
      // Example: Vercel Analytics
      if (typeof window !== 'undefined' && (window as any).va) {
        (window as any).va('track', 'PDF Upload', {
          storageId: metrics.documentStorageId,
          fileSize: metrics.fileSize,
          chunkCount: metrics.chunkCount,
          duration: metrics.totalDuration,
          success: metrics.success,
          errorStep: metrics.errorStep,
          wasRenamed: metrics.wasRenamed,
        });
      }

      // Example: Custom endpoint
      if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
        await fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'pdf_upload',
            timestamp: new Date().toISOString(),
            metrics,
          }),
        });
      }
    } catch (error) {
      // Don't throw - monitoring failures shouldn't break uploads
      console.error('[UploadMetrics] Error tracking metrics:', error);
    }
  }
}

/**
 * Alert on upload failures
 *
 * Sends alerts for critical failures that need immediate attention.
 */
export async function alertUploadFailure(metrics: UploadMetrics): Promise<void> {
  // Only alert on critical failures in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Critical error steps that need immediate attention
  const criticalSteps = ['pinecone', 'database'];

  if (!criticalSteps.includes(metrics.errorStep || '')) {
    return;
  }

  try {
    // Example: Slack webhook
    if (process.env.SLACK_ALERT_WEBHOOK) {
      await fetch(process.env.SLACK_ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Critical Upload Failure`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Critical Upload Failure*\n` +
                      `*Step*: ${metrics.errorStep}\n` +
                      `*Error*: ${metrics.errorMessage}\n` +
                      `*Account*: ${metrics.accountId}\n` +
                      `*File*: ${metrics.fileName} (${(metrics.fileSize / 1024 / 1024).toFixed(2)}MB)`,
              },
            },
          ],
        }),
      });
    }

    // Example: Email alert (using Resend, SendGrid, etc.)
    if (process.env.ALERT_EMAIL_ENDPOINT) {
      await fetch(process.env.ALERT_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: process.env.ALERT_EMAIL_RECIPIENTS,
          subject: `[CRITICAL] Upload Failure - ${metrics.errorStep}`,
          body: `Upload failed at ${metrics.errorStep} step.\n\n` +
                `Account: ${metrics.accountId}\n` +
                `File: ${metrics.fileName}\n` +
                `Error: ${metrics.errorMessage}`,
        }),
      });
    }
  } catch (error) {
    console.error('[UploadMetrics] Error sending alert:', error);
  }
}

/**
 * Track upload duration
 *
 * Helper class to measure durations of different steps.
 */
export class UploadTimer {
  private startTime: number;
  private stepTimes: Map<string, number>;

  constructor() {
    this.startTime = Date.now();
    this.stepTimes = new Map();
  }

  markStepStart(step: string): void {
    this.stepTimes.set(`${step}_start`, Date.now());
  }

  markStepEnd(step: string): number {
    const startKey = `${step}_start`;
    const startTime = this.stepTimes.get(startKey);

    if (!startTime) {
      console.warn(`[UploadTimer] Step ${step} was never started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.stepTimes.set(`${step}_duration`, duration);
    return duration;
  }

  getTotalDuration(): number {
    return Date.now() - this.startTime;
  }

  getStepDuration(step: string): number {
    return this.stepTimes.get(`${step}_duration`) || 0;
  }

  getAllMetrics() {
    return {
      total: this.getTotalDuration(),
      embedding: this.getStepDuration('embedding'),
      pinecone: this.getStepDuration('pinecone'),
      vapi: this.getStepDuration('vapi'),
      database: this.getStepDuration('database'),
    };
  }
}
