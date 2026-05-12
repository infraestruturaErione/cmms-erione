import { Priority } from './workOrder';
import { SearchCriteria } from './page';

export type WorkOrderOperationalReportPeriodField =
  | 'CREATED_AT'
  | 'COMPLETED_ON'
  | 'CHECK_IN_AT';

export interface WorkOrderOperationalReportRequest {
  searchCriteria: SearchCriteria;
  periodField: WorkOrderOperationalReportPeriodField;
  start?: string | null;
  end?: string | null;
}

export interface WorkOrderOperationalReportRow {
  id: number;
  customId: string;
  title: string;
  description: string;
  customerNames: string[];
  locationName: string;
  assetName: string;
  technicianName: string;
  priority: Priority;
  status: string;
  createdAt: string;
  completedOn: string;
  departureAt: string;
  checkInAt: string;
  checkOutAt: string;
  travelDurationSeconds: number;
  siteDurationSeconds: number;
  totalFieldDurationSeconds: number;
  fieldReport: string;
  filesCount: number;
  hasImage: boolean;
  hasSignature: boolean;
}

export interface WorkOrderOperationalReportSummary {
  total: number;
  open: number;
  enRoute: number;
  inProgress: number;
  onHold: number;
  complete: number;
  withCheckIn: number;
  withCheckOut: number;
  withFieldReport: number;
  withAttachments: number;
  withSignature: number;
}

export interface WorkOrderOperationalReportPage {
  totalElements: number;
  totalPages: number;
  pageNum: number;
  pageSize: number;
}

export interface WorkOrderOperationalReportResponse {
  rows: WorkOrderOperationalReportRow[];
  summary: WorkOrderOperationalReportSummary;
  page: WorkOrderOperationalReportPage;
}
