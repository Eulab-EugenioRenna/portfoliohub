import { queueJobId } from './queue-job-id';

describe('queueJobId', () => {
  it('builds a deterministic BullMQ-safe identifier', () => {
    expect(queueJobId('preview', '4f5a0b61-13ce-49c1-995f-a992613d0978', 'image')).toBe(
      'preview-4f5a0b61-13ce-49c1-995f-a992613d0978-image',
    );
  });

  it('rejects reserved or ambiguous segments', () => {
    expect(() => queueJobId('trash:unsafe', 'node')).toThrow('Queue job ID segments');
    expect(() => queueJobId()).toThrow('at least one segment');
  });
});
