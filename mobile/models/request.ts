import WorkOrder from './workOrder';
import { WorkOrderBase } from './workOrderBase';
import File from './file';

export type RequestWorkOrderReference = Pick<
  WorkOrder,
  'id' | 'customId' | 'title' | 'status'
>;

export default interface Request extends WorkOrderBase {
  cancelled: boolean;
  audioDescription: File;
  workOrder: RequestWorkOrderReference;
  customId: string;
}
