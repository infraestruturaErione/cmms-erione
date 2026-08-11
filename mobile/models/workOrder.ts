import { Audit } from './audit';
import Request from './request';
import Team from './team';
import Asset from './asset';
import File from './file';
import Location from './location';
import Category from './category';
import { OwnUser, UserMiniDTO } from './user';
import { CustomerMiniDTO } from './customer';
import PreventiveMaintenance from './preventiveMaintenance';
import { WorkOrderBase } from './workOrderBase';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export const WORK_ORDER_STATUSES = [
  'OPEN',
  'EN_ROUTE',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETE'
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export default interface WorkOrder extends WorkOrderBase {
  category: Category | null;
  id: number;
  completedBy: OwnUser;
  completedOn: string;
  archived: boolean;
  parentRequest: Request;
  parentPreventiveMaintenance: PreventiveMaintenance;
  signature: string;
  signerName?: string;
  signerDocument?: string;
  mileageTraveled?: number;
  feedback: string;
  requiredSignature: boolean;
  requireSignerName: boolean;
  requireSignerDocument: boolean;
  requirePhotos: boolean;
  requireFieldReport: boolean;
  requireMileage: boolean;
  requireChecklistCompletion: boolean;
  status: WorkOrderStatus;
  audioDescription: File;
  customId: string;
  departureAt?: string | null;
  departureLat?: number | null;
  departureLng?: number | null;
  checkInAt?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInAddress?: string | null;
  checkOutAt?: string | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutAddress?: string | null;
  //parentPreventiveMaintenance:
}
