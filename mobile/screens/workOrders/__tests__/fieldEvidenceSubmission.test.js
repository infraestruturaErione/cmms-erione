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
