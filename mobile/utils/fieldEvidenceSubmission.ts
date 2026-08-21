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
};

export const submitFieldEvidenceWithCleanup = async ({
  evidenceFiles,
  uploadFiles,
  createComment,
  cleanupUnusedFiles
}: SubmitFieldEvidenceParams) => {
  const uploadedFiles = await uploadFiles([], evidenceFiles, false);
  const uploadedFileIds = uploadedFiles.map((file) => file.id);

  try {
    return await createComment(uploadedFileIds.map((id) => ({ id })));
  } catch (commentError) {
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
};
