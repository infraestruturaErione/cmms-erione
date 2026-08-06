export type GeneratedReportStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface GeneratedReport {
  id: number;
  description: string;
  requestedByName: string;
  requestedAt: string;
  status: GeneratedReportStatus;
  expiresAt: string;
  available: boolean;
}
