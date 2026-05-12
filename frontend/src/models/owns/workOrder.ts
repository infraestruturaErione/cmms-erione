import { Audit } from './audit';
import Request from './request';
import Team from './team';
import Asset from './asset';
import File from './file';
import Location from './location';
import Category from './category';
import { OwnUser, UserMiniDTO } from '../user';
import { CustomerMiniDTO } from './customer';
import PreventiveMaintenance from './preventiveMaintenance';
import { WorkOrderBase } from './workOrderBase';
import { CustomField } from './customField';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

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
  status: string;
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

export interface WorkOrderMini {
  id: number;
  title: string;
  status: string;
  createdAt: string;
}
