/**
 * Learn more about using TypeScript with React Navigation:
 * https://reactnavigation.org/docs/typescript/
 */

import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  CompositeScreenProps,
  NavigatorScreenParams
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import WorkOrder from './models/workOrder';
import { PartMiniDTO } from './models/part';
import { Task } from './models/tasks';
import { Customer, CustomerMiniDTO } from './models/customer';
import { VendorMiniDTO } from './models/vendor';
import User, { OwnUser, UserMiniDTO } from './models/user';
import Team, { TeamMiniDTO } from './models/team';
import Location, { LocationMiniDTO } from './models/location';
import { AssetDTO, AssetMiniDTO } from './models/asset';
import Category from './models/category';
import { FilterField } from './models/page';
import Request from './models/request';
import { MeterMiniDTO } from './models/meter';

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

export type RootStackParamList = {
  Root: NavigatorScreenParams<RootTabParamList> | undefined;
  AddWorkOrder: { location?: Location; asset?: AssetDTO };
  EditWorkOrder: { workOrder: WorkOrder; tasks: Task[] };
  EditRequest: { request: Request };
  EditAsset: { asset: AssetDTO };
  EditLocation: { location: Location };
  EditUser: { user: User };
  EditCustomer: { customer: Customer };
  EditTeam: { team: Team };
  AddRequest: undefined;
  AddAsset: {
    location?: Location;
    parentAsset?: AssetDTO;
    nfcId?: string;
    barCode?: string;
  };
  AddLocation: undefined;
  AddUser: undefined;
  WODetails: { id: number; workOrderProp?: WorkOrder };
  AssetDetails: { id: number; assetProp?: AssetDTO };
  LocationDetails: { id: number; locationProp?: Location };
  RequestDetails: { id: number; requestProp?: Request };
  UserDetails: { id: number; userProp?: OwnUser };
  UserProfile: undefined;
  TeamDetails: { id: number; teamProp?: Team };
  CustomerDetails: { id: number; customerProp?: Customer };
  Modal: undefined;
  Tasks: {
    tasksProps: Task[];
    workOrderId: number;
  };
  SelectParts: { onChange: (parts: PartMiniDTO[]) => void; selected: number[] };
  SelectCustomers: {
    onChange: (customers: CustomerMiniDTO[]) => void;
    selected: number[];
    multiple: boolean;
  };
  SelectVendors: {
    onChange: (vendors: VendorMiniDTO[]) => void;
    selected: number[];
    multiple: boolean;
  };
  SelectUsers: {
    onChange: (users: UserMiniDTO[]) => void;
    selected: number[];
    multiple: boolean;
  };
  SelectTeams: {
    onChange: (teams: TeamMiniDTO[]) => void;
    selected: number[];
    multiple: boolean;
  };
  SelectMeters: {
    onChange: (meters: MeterMiniDTO[]) => void;
    selected: number[];
    multiple: boolean;
  };
  SelectLocations: {
    onChange: (locations: LocationMiniDTO[]) => void;
    selected: number[];
    multiple: boolean;
  };
  SelectAssets: {
    onChange: (assets: AssetMiniDTO[]) => void;
    selected: number[];
    multiple: boolean;
    locationId: number | null;
  };
  SelectTasks: { onChange: (tasks: Task[]) => void; selected: Task[] };
  SelectChecklists: {
    onChange: (tasks: Task[]) => void;
    selected: Task[];
    excludedChecklistId?: number;
  };
  SelectTasksOrChecklist: {
    onChange: (tasks: Task[]) => void;
    selected: Task[];
    excludedChecklistId?: number;
  };
  SelectCategories: {
    onChange: (categories: Category[]) => void;
    selected: number[];
    multiple: boolean;
    type: string;
  };
  SelectNfc: { onChange: (value: string) => void };
  SelectBarcode: { onChange: (value: string) => void };
  CompleteWorkOrder: {
    onComplete: (values: {
      signature?: string;
      feedback?: string;
      signerName?: string;
      signerDocument?: string;
      mileageTraveled?: number;
    }) => Promise<any>;
    fieldsConfig: {
      feedback: boolean;
      signature: boolean;
      signerName?: boolean;
      signerDocument?: boolean;
      mileageTraveled?: boolean;
    };
    initialFeedback?: string;
  };
  NotFound: undefined;
  Locations: { id?: number; hierarchy?: number[] };
  Assets: { id?: number; hierarchy?: number[] };
  PeopleTeams: undefined;
  VendorsCustomers: undefined;
  Notifications: undefined;
  Settings: undefined;
  WorkOrderFilters: {
    filterFields: FilterField[];
    onFilterChange: (filterFields: FilterField[]) => void;
  };
  AddAdditionalCost: { workOrderId: number };
  AddAdditionalTime: { workOrderId: number };
  ScanAsset: {
    onChange?: (asset: AssetMiniDTO) => void;
  };
};

export type RootStackScreenProps<Screen extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Screen>;

export type RootTabParamList = {
  Home: undefined;
  WorkOrders: { filterFields: FilterField[]; fromHome?: boolean };
  AddEntities: undefined;
  Requests: undefined;
  MoreEntities: undefined;
};
export type RootParamList = RootStackParamList & RootTabParamList;

export type RootTabScreenProps<Screen extends keyof RootTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<RootTabParamList, Screen>,
    NativeStackScreenProps<RootStackParamList>
  >;
export type AuthStackParamList = {
  Welcome: undefined;
  Register: undefined;
  Login: undefined;
  Verify: undefined;
};
export type AuthStackScreenProps<Screen extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, Screen>;
