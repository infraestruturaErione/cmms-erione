import { UserMiniDTO } from '../user';
import { Audit } from './audit';
import { CustomerMiniDTO } from './customer';
import { VendorMiniDTO } from './vendor';
import { TeamMiniDTO } from './team';
import { FileMiniDTO } from './file';
import { CustomFieldValue } from './customField';

// Referencia Operacional (ID/PC) - presentation-only, opcional. Espelha
// com.grash.model.enums.LocationReferenceType do backend. Nunca reaproveita
// Location.id nem customId.
export enum LocationReferenceType {
  ID = 'ID',
  PC = 'PC'
}

export default interface Location extends Audit {
  id: number;
  name: string;
  address: string;
  longitude: number;
  image: FileMiniDTO;
  files: FileMiniDTO[];
  latitude: number;
  parentLocation: LocationMiniDTO | null;
  vendors: VendorMiniDTO[];
  customers: CustomerMiniDTO[];
  workers: UserMiniDTO[];
  teams: TeamMiniDTO[];
  customId: string;
  referenceType?: LocationReferenceType | null;
  referenceCode?: string | null;
  customFieldValues: CustomFieldValue[];
}
export interface LocationMiniDTO {
  id: number;
  name: string;
  address: string;
  customId: string;
  parentId: number;
  longitude?: number;
  latitude?: number;
  referenceType?: LocationReferenceType | null;
  referenceCode?: string | null;
}

export interface LocationRow extends Location {
  hierarchy: number[];
  childrenFetched?: boolean;
  hasChildren?: boolean;
}
