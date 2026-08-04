import { Audit } from './audit';

export default interface Category extends Audit {
  id: number;
  name: string;
  // Campos de "Tipo de Tarefa" - so preenchidos em categorias de Ordem de
  // Servico (WorkOrderCategory). Nas demais categorias ficam undefined.
  toleranceMinutes?: number;
  defaultEstimatedDuration?: number;
  defaultChecklist?: { id: number; name: string };
  requireSignature?: boolean;
  requireSignerName?: boolean;
  requireSignerDocument?: boolean;
  requirePhotos?: boolean;
  requireFieldReport?: boolean;
  requireMileage?: boolean;
  requireChecklistCompletion?: boolean;
}
export interface CategoryMiniDTO {
  id: number;
  name: string;
}
export const categories: Category[] = [
  {
    id: 6,
    name: 'hdvykg',
    createdBy: 1,
    updatedBy: 4,
    createdAt: 'sd',
    updatedAt: 'sdd'
  },
  {
    id: 7,
    name: 'vvuykydr',
    createdBy: 1,
    updatedBy: 4,
    createdAt: 'sd',
    updatedAt: 'sdd'
  }
];
