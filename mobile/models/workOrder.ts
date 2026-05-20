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
export type WorkOrderStatus =
  | 'OPEN'
  | 'ON_HOLD'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'CLOSED'
  | 'CANCELLED';

export default interface WorkOrder extends WorkOrderBase {
  category: Category | null;
  id: number;
  completedBy: OwnUser;
  completedOn: string;
  archived: boolean;
  parentRequest: Request;
  parentPreventiveMaintenance: PreventiveMaintenance;
  signature: string;
  feedback: string;
  requiredSignature: boolean;
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
