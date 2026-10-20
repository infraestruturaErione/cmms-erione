type EvidenceFile = { uri: string; name: string; type: string };
type UploadedFile = { id: number };
type CommentFile = { id: number };

type SubmitFieldEvidenceParams = {
  evidenceFiles: EvidenceFile[];
  uploadFiles: (
    files: EvidenceFile[],
    images: EvidenceFile[],
    hidden?: boolean
  ) => Promise<UploadedFile[]>;
  createComment: (files: CommentFile[]) => Promise<unknown>;
  cleanupUnusedFiles: (fileIds: number[]) => Promise<unknown>;
  onConfirmedUploads?: (files: UploadedFile[]) => Promise<void>;
  onUploaded?: (files: UploadedFile[]) => void;
  reconcile?: (fileIds: number[]) => Promise<unknown | undefined>;
};

export const submitFieldEvidenceWithCleanup = async ({
  evidenceFiles,
  uploadFiles,
  createComment,
  cleanupUnusedFiles,
  onConfirmedUploads,
  onUploaded,
  reconcile
}: SubmitFieldEvidenceParams) => {
  const uploadedFiles = await uploadFiles([], evidenceFiles, false);
  const uploadedFileIds = uploadedFiles.map((file) => file.id);
  onUploaded?.(uploadedFiles);

  let comment: unknown;
  try {
    comment = await createComment(uploadedFileIds.map((id) => ({ id })));
  } catch (commentError) {
    if (reconcile) {
      try {
        comment = await reconcile(uploadedFileIds);
      } catch {
        throw commentError;
      }
    }
    if (!comment) {
      if (uploadedFileIds.length) {
        try {
          await cleanupUnusedFiles(uploadedFileIds);
        } catch (cleanupError) {
          console.warn(
            '[FieldEvidence] Failed to clean up unused uploaded files',
            cleanupError
          );
        }
      }

      throw commentError;
    }
  }
  // Never roll back confirmed evidence because local bookkeeping failed.
  if (onConfirmedUploads) {
    try {
      await onConfirmedUploads(uploadedFiles);
    } catch {
      console.warn(
        '[FieldEvidence] Local temporary-file tracking unavailable.'
      );
    }
  }
  return comment;
};
