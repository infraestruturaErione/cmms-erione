import type { ReactNode } from 'react';

import InsertChartTwoToneIcon from '@mui/icons-material/InsertChartTwoTone';
import SettingsTwoToneIcon from '@mui/icons-material/SettingsTwoTone';
import CategoryTwoToneIcon from '@mui/icons-material/CategoryTwoTone';
import AttachFileTwoToneIcon from '@mui/icons-material/AttachFileTwoTone';
import { GroupsTwoTone, People } from '@mui/icons-material';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import Inventory2TwoToneIcon from '@mui/icons-material/Inventory2TwoTone';
import HandymanTwoToneIcon from '@mui/icons-material/HandymanTwoTone';
import SpeedTwoToneIcon from '@mui/icons-material/SpeedTwoTone';
import MoveToInboxTwoToneIcon from '@mui/icons-material/MoveToInboxTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import PendingActionsTwoToneIcon from '@mui/icons-material/PendingActionsTwoTone';
import ReceiptTwoToneIcon from '@mui/icons-material/ReceiptTwoTone';
import { PermissionEntity } from '../../../../models/owns/role';
import { PlanFeature } from '../../../../models/owns/subscriptionPlan';
import { UiConfiguration } from '../../../../models/owns/uiConfiguration';
import { ERIONE_HIDDEN_MODULES } from '../../../../config/erioneModules';

export interface MenuItem {
  link?: string;
  icon?: ReactNode;
  badge?: string;
  badgeTooltip?: string;
  permission?: PermissionEntity;
  planFeature?: PlanFeature;
  uiConfigKey?: keyof Omit<UiConfiguration, 'id'>;

  items?: MenuItem[];
  name: string;
}

export interface MenuItems {
  items: MenuItem[];
  heading: string;
  hidden?: PermissionEntity;
}

const workOrderAnalyticsItems: MenuItem[] = [
  {
    name: 'work_orders',
    icon: AssignmentTwoToneIcon,
    items: [
      {
        name: 'operational_work_order_report',
        link: '/app/analytics/work-orders/operational-report'
      },
      {
        name: 'status_report',
        link: '/app/analytics/work-orders/status'
      },
      {
        name: 'wo_analysis',
        link: '/app/analytics/work-orders/analysis'
      },
      {
        name: 'wo_aging',
        link: '/app/analytics/work-orders/aging'
      },
      {
        name: 'time_and_cost',
        link: '/app/analytics/work-orders/time-cost'
      }
    ]
  },
  {
    name: 'assets',
    icon: Inventory2TwoToneIcon,
    items: [
      {
        name: 'reliability_dashboard',
        link: '/app/analytics/assets/reliability'
      },
      {
        name: 'total_maintenance_cost',
        link: '/app/analytics/assets/cost'
      }
    ]
  },
  ...(!ERIONE_HIDDEN_MODULES.parts
    ? [
        {
          name: 'parts',
          icon: HandymanTwoToneIcon,
          items: [
            {
              name: 'parts_consumption',
              link: '/app/analytics/parts/consumption'
            }
          ]
        }
      ]
    : []),
  {
    name: 'requests',
    icon: MoveToInboxTwoToneIcon,
    items: [
      {
        name: 'requests_analysis',
        link: '/app/analytics/requests/analysis'
      }
    ]
  }
];

const inventoryItems: MenuItem[] = !ERIONE_HIDDEN_MODULES.inventory
  ? [
      {
        name: 'parts_and_inventory',
        link: '/app/inventory',
        icon: HandymanTwoToneIcon,
        permission: PermissionEntity.PARTS_AND_MULTIPARTS,
        items: [
          {
            name: 'parts',
            link: '/app/inventory/parts'
          },
          {
            name: 'sets_of_parts',
            link: '/app/inventory/sets'
          }
        ]
      }
    ]
  : [];

const purchaseOrderItems: MenuItem[] = !ERIONE_HIDDEN_MODULES.purchaseOrders
  ? [
      {
        name: 'purchase_orders',
        link: '/app/purchase-orders',
        icon: ReceiptTwoToneIcon,
        permission: PermissionEntity.PURCHASE_ORDERS,
        planFeature: PlanFeature.PURCHASE_ORDER
      }
    ]
  : [];

const ownMenuItems: MenuItems[] = [
  {
    heading: 'erione_nav_operation',
    items: [
      {
        name: 'work_orders',
        link: '/app/work-orders',
        icon: AssignmentTwoToneIcon
      },
      {
        name: 'preventive_maintenance',
        link: '/app/preventive-maintenances',
        icon: PendingActionsTwoToneIcon,
        permission: PermissionEntity.PREVENTIVE_MAINTENANCES
      },
      {
        name: 'requests',
        icon: MoveToInboxTwoToneIcon,
        permission: PermissionEntity.REQUESTS,
        uiConfigKey: 'requests',
        items: [
          {
            name: 'all_requests',
            link: '/app/requests'
          },
          {
            name: 'quick_request',
            link: '/app/requests/quick'
          }
        ]
      }
    ]
  },
  {
    heading: 'erione_nav_records',
    items: [
      {
        name: 'customers',
        link: '/app/vendors-customers/customers',
        icon: GroupsTwoTone,
        permission: PermissionEntity.VENDORS_AND_CUSTOMERS,
        uiConfigKey: 'vendorsAndCustomers',
        items: [
          ...(!ERIONE_HIDDEN_MODULES.vendors
            ? [
                {
                  name: 'vendors',
                  link: '/app/vendors-customers/vendors'
                }
              ]
            : []),
          {
            name: 'customers',
            link: '/app/vendors-customers/customers'
          }
        ]
      },
      {
        name: 'locations',
        link: '/app/locations',
        icon: LocationOnTwoToneIcon,
        permission: PermissionEntity.LOCATIONS,
        uiConfigKey: 'locations'
      },
      {
        name: 'assets',
        link: '/app/assets',
        icon: Inventory2TwoToneIcon,
        permission: PermissionEntity.ASSETS
      },
      {
        name: 'people_teams',
        link: '/app/people-teams',
        icon: People,
        permission: PermissionEntity.PEOPLE_AND_TEAMS,
        items: [
          {
            name: 'people',
            link: '/app/people-teams/people'
          },
          {
            name: 'teams',
            link: '/app/people-teams/teams'
          }
        ]
      }
    ]
  },
  {
    heading: 'erione_nav_reports',
    items: [
      {
        name: 'Statistics',
        icon: InsertChartTwoToneIcon,
        permission: PermissionEntity.ANALYTICS,
        planFeature: PlanFeature.ANALYTICS,
        items: workOrderAnalyticsItems
      }
    ]
  },
  {
    heading: 'erione_nav_admin',
    items: [
      ...inventoryItems,
      ...purchaseOrderItems,
      {
        name: 'meters',
        link: '/app/meters',
        icon: SpeedTwoToneIcon,
        permission: PermissionEntity.METERS,
        planFeature: PlanFeature.METER,
        uiConfigKey: 'meters'
      },
      {
        name: 'categories',
        link: '/app/categories',
        icon: CategoryTwoToneIcon,
        permission: PermissionEntity.CATEGORIES_WEB
      },
      {
        name: 'files',
        link: '/app/files',
        icon: AttachFileTwoToneIcon,
        permission: PermissionEntity.FILES,
        planFeature: PlanFeature.FILE
      },
      {
        name: 'settings',
        link: '/app/settings',
        icon: SettingsTwoToneIcon,
        permission: PermissionEntity.SETTINGS
      }
    ]
  }
];

export default ownMenuItems;
