import { submitFieldEvidenceWithCleanup } from '../../../utils/fieldEvidenceSubmission';

const evidenceFiles = [
  { uri: 'file://photo-1.jpg', name: 'photo-1.jpg', type: 'image/jpeg' }
];

const setup = () => ({
  uploadFiles: jest.fn(),
  createComment: jest.fn(),
  cleanupUnusedFiles: jest.fn()
});

const submit = (dependencies) =>
  submitFieldEvidenceWithCleanup({
    evidenceFiles,
    ...dependencies
  });

describe('mobile field evidence cleanup', () => {
  it('reconciles a lost response by exact uploaded IDs without deleting confirmed photos', async () => {
    const dependencies = setup();
    dependencies.uploadFiles.mockResolvedValue([{ id: 10 }]);
    dependencies.createComment.mockRejectedValue(new Error('connection lost'));
    dependencies.reconcile = jest.fn().mockResolvedValue({ id: 100 });
    dependencies.onConfirmedUploads = jest.fn();
    await expect(submit(dependencies)).resolves.toEqual({ id: 100 });
    expect(dependencies.reconcile).toHaveBeenCalledWith([10]);
    expect(dependencies.cleanupUnusedFiles).not.toHaveBeenCalled();
    expect(dependencies.onConfirmedUploads).toHaveBeenCalledTimes(1);
  });
  it('unknown reconciliation preserves objects and reports uncertainty instead of success', async () => {
    const dependencies = setup();
    dependencies.uploadFiles.mockResolvedValue([{ id: 10 }]);
    dependencies.createComment.mockRejectedValue(new Error('unknown outcome'));
    dependencies.reconcile = jest.fn().mockRejectedValue(new Error('offline'));
    dependencies.onConfirmedUploads = jest.fn();
    await expect(submit(dependencies)).rejects.toThrow('unknown outcome');
    expect(dependencies.cleanupUnusedFiles).not.toHaveBeenCalled();
    expect(dependencies.onConfirmedUploads).not.toHaveBeenCalled();
  });
  it('tracks temporary uploads only after confirmed attachment and never rolls back for local index failure', async () => {
    const dependencies = setup();
    dependencies.uploadFiles.mockResolvedValue([{ id: 10 }]);
    dependencies.createComment.mockResolvedValue({ id: 100 });
    dependencies.onConfirmedUploads = jest.fn(async () => {
      throw new Error('storage full');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(submit(dependencies)).resolves.toEqual({ id: 100 });
    expect(dependencies.onConfirmedUploads).toHaveBeenCalledWith([{ id: 10 }]);
    expect(dependencies.createComment.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.onConfirmedUploads.mock.invocationCallOrder[0]
    );
    expect(dependencies.cleanupUnusedFiles).not.toHaveBeenCalled();
    dependencies.createComment.mockRejectedValueOnce(new Error('link failed'));
    dependencies.onConfirmedUploads.mockClear();
    await expect(submit(dependencies)).rejects.toThrow('link failed');
    expect(dependencies.onConfirmedUploads).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('does not call cleanup when upload fails', async () => {
    const dependencies = setup();
    const uploadError = new Error('upload failed');
    dependencies.uploadFiles.mockRejectedValue(uploadError);

    await expect(submit(dependencies)).rejects.toBe(uploadError);
    expect(dependencies.createComment).not.toHaveBeenCalled();
    expect(dependencies.cleanupUnusedFiles).not.toHaveBeenCalled();
  });

  it('does not call cleanup when upload and comment succeed', async () => {
    const dependencies = setup();
    dependencies.uploadFiles.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    dependencies.createComment.mockResolvedValue({ id: 100 });

    await expect(submit(dependencies)).resolves.toEqual({ id: 100 });
    expect(dependencies.cleanupUnusedFiles).not.toHaveBeenCalled();
  });

  it('calls cleanup with the exact uploaded IDs when comment creation fails', async () => {
    const dependencies = setup();
    const commentError = new Error('comment failed');
    dependencies.uploadFiles.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    dependencies.createComment.mockRejectedValue(commentError);
    dependencies.cleanupUnusedFiles.mockResolvedValue({ removed: [10, 11] });

    await expect(submit(dependencies)).rejects.toBe(commentError);
    expect(dependencies.cleanupUnusedFiles).toHaveBeenCalledTimes(1);
    expect(dependencies.cleanupUnusedFiles).toHaveBeenCalledWith([10, 11]);
  });

  it('keeps propagating the original comment error after successful cleanup', async () => {
    const dependencies = setup();
    const commentError = new Error('original comment error');
    dependencies.uploadFiles.mockResolvedValue([{ id: 20 }]);
    dependencies.createComment.mockRejectedValue(commentError);
    dependencies.cleanupUnusedFiles.mockResolvedValue({ removed: [20] });

    await expect(submit(dependencies)).rejects.toBe(commentError);
  });

  it('keeps propagating the original comment error when cleanup also fails', async () => {
    const dependencies = setup();
    const commentError = new Error('original comment error');
    dependencies.uploadFiles.mockResolvedValue([{ id: 30 }]);
    dependencies.createComment.mockRejectedValue(commentError);
    dependencies.cleanupUnusedFiles.mockRejectedValue(
      new Error('cleanup failed')
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(submit(dependencies)).rejects.toBe(commentError);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does not call cleanup when upload returns no IDs', async () => {
    const dependencies = setup();
    const commentError = new Error('comment failed');
    dependencies.uploadFiles.mockResolvedValue([]);
    dependencies.createComment.mockRejectedValue(commentError);

    await expect(submit(dependencies)).rejects.toBe(commentError);
    expect(dependencies.cleanupUnusedFiles).not.toHaveBeenCalled();
  });
});
