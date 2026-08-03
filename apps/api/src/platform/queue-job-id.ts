const SAFE_QUEUE_JOB_ID_SEGMENT = /^[A-Za-z0-9_-]+$/;

/**
 * Builds BullMQ custom job IDs without the reserved `:` separator.
 * Keeping this contract in one place prevents add/remove calls from drifting.
 */
export function queueJobId(...segments: Array<string | number>): string {
  if (segments.length === 0) throw new Error('Queue job ID requires at least one segment');

  const normalized = segments.map(String);
  if (normalized.some((segment) => !SAFE_QUEUE_JOB_ID_SEGMENT.test(segment))) {
    throw new Error(
      'Queue job ID segments may only contain letters, numbers, underscores and dashes',
    );
  }

  return normalized.join('-');
}
