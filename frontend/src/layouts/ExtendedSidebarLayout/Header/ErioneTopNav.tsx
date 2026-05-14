import {
  MouseEvent,
  ReactNode,
  useMemo,
  useRef,
  useState
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem as MuiMenuItem,
  Paper,
  Popper,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import KeyboardArrowDownTwoToneIcon from '@mui/icons-material/KeyboardArrowDownTwoTone';
import ArrowForwardTwoToneIcon from '@mui/icons-material/ArrowForwardTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import CalendarMonthTwoToneIcon from '@mui/icons-material/CalendarMonthTwoTone';
import MoveToInboxTwoToneIcon from '@mui/icons-material/MoveToInboxTwoTone';
import AddTaskTwoToneIcon from '@mui/icons-material/AddTaskTwoTone';
import GroupsTwoToneIcon from '@mui/icons-material/GroupsTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import Inventory2TwoToneIcon from '@mui/icons-material/Inventory2TwoTone';
import PeopleTwoToneIcon from '@mui/icons-material/PeopleTwoTone';
import InsertChartTwoToneIcon from '@mui/icons-material/InsertChartTwoTone';
import AnalyticsTwoToneIcon from '@mui/icons-material/AnalyticsTwoTone';
import SettingsTwoToneIcon from '@mui/icons-material/SettingsTwoTone';
import CategoryTwoToneIcon from '@mui/icons-material/CategoryTwoTone';
import MoreHorizTwoToneIcon from '@mui/icons-material/MoreHorizTwoTone';
import PendingActionsTwoToneIcon from '@mui/icons-material/PendingActionsTwoTone';
import SpeedTwoToneIcon from '@mui/icons-material/SpeedTwoTone';
import AttachFileTwoToneIcon from '@mui/icons-material/AttachFileTwoTone';
import QueryStatsTwoToneIcon from '@mui/icons-material/QueryStatsTwoTone';
import PriceCheckTwoToneIcon from '@mui/icons-material/PriceCheckTwoTone';
import { useTranslation } from 'react-i18next';

import useAuth from '../../../hooks/useAuth';
import menuItems, { MenuItem } from '../Sidebar/SidebarMenu/items';
import { ERIONE_VISUAL_IDENTITY } from '../../../config/erioneVisualIdentity';

interface TopNavEntry {
  name: string;
  description: string;
  link: string;
  icon: ReactNode;
  sourceName: string;
  section?: string;
}

interface TopNavSection {
  heading: string;
  description: string;
  items: TopNavEntry[];
}

const curatedSections: TopNavSection[] = [
  {
    heading: 'erione_nav_operation',
    description: 'erione_nav_operation_desc',
    items: [
      {
        name: 'work_orders',
        description: 'erione_nav_desc_work_orders',
        link: '/app/work-orders',
        icon: <AssignmentTwoToneIcon fontSize="small" />,
        sourceName: 'work_orders'
      },
      {
        name: 'erione_nav_calendar',
        description: 'erione_nav_desc_calendar',
        link: '/app/work-orders?view=calendar',
        icon: <CalendarMonthTwoToneIcon fontSize="small" />,
        sourceName: 'work_orders'
      },
      {
        name: 'requests',
        description: 'erione_nav_desc_requests',
        link: '/app/requests',
        icon: <MoveToInboxTwoToneIcon fontSize="small" />,
        sourceName: 'all_requests'
      },
      {
        name: 'quick_request',
        description: 'erione_nav_desc_quick_request',
        link: '/app/requests/quick',
        icon: <AddTaskTwoToneIcon fontSize="small" />,
        sourceName: 'quick_request'
      }
    ]
  },
  {
    heading: 'erione_nav_records',
    description: 'erione_nav_records_desc',
    items: [
      {
        name: 'customers',
        description: 'erione_nav_desc_customers',
        link: '/app/vendors-customers/customers',
        icon: <GroupsTwoToneIcon fontSize="small" />,
        sourceName: 'customers'
      },
      {
        name: 'locations',
        description: 'erione_nav_desc_locations',
        link: '/app/locations',
        icon: <LocationOnTwoToneIcon fontSize="small" />,
        sourceName: 'locations'
      },
      {
        name: 'assets',
        description: 'erione_nav_desc_assets',
        link: '/app/assets',
        icon: <Inventory2TwoToneIcon fontSize="small" />,
        sourceName: 'assets'
      },
      {
        name: 'people_teams',
        description: 'erione_nav_desc_people_teams',
        link: '/app/people-teams',
        icon: <PeopleTwoToneIcon fontSize="small" />,
        sourceName: 'people_teams'
      }
    ]
  },
  {
    heading: 'erione_nav_reports',
    description: 'erione_nav_reports_desc',
    items: [
      {
        name: 'operational_work_order_report',
        description: 'erione_nav_desc_operational_report',
        link: '/app/analytics/work-orders/operational-report',
        icon: <InsertChartTwoToneIcon fontSize="small" />,
        sourceName: 'operational_work_order_report'
      },
      {
        name: 'status_report',
        description: 'erione_nav_desc_wo_reports',
        link: '/app/analytics/work-orders/status',
        icon: <AssignmentTwoToneIcon fontSize="small" />,
        sourceName: 'status_report'
      },
      {
        name: 'wo_analysis',
        description: 'erione_nav_desc_wo_analytics',
        link: '/app/analytics/work-orders/analysis',
        icon: <AnalyticsTwoToneIcon fontSize="small" />,
        sourceName: 'wo_analysis'
      }
    ]
  },
  {
    heading: 'erione_nav_admin',
    description: 'erione_nav_admin_desc',
    items: [
      {
        name: 'settings',
        description: 'erione_nav_desc_settings',
        link: '/app/settings',
        icon: <SettingsTwoToneIcon fontSize="small" />,
        sourceName: 'settings'
      },
      {
        name: 'erione_nav_custom_fields_categories',
        description: 'erione_nav_desc_custom_fields_categories',
        link: '/app/categories',
        icon: <CategoryTwoToneIcon fontSize="small" />,
        sourceName: 'categories'
      }
    ]
  },
  {
    heading: 'erione_nav_more',
    description: 'erione_nav_more_desc',
    items: [
      {
        name: 'preventive_maintenance',
        description: 'erione_nav_desc_preventive_maintenance',
        link: '/app/preventive-maintenances',
        icon: <PendingActionsTwoToneIcon fontSize="small" />,
        sourceName: 'preventive_maintenance',
        section: 'erione_nav_more_operational'
      },
      {
        name: 'meters',
        description: 'erione_nav_desc_meters',
        link: '/app/meters',
        icon: <SpeedTwoToneIcon fontSize="small" />,
        sourceName: 'meters',
        section: 'erione_nav_more_operational'
      },
      {
        name: 'files',
        description: 'erione_nav_desc_files',
        link: '/app/files',
        icon: <AttachFileTwoToneIcon fontSize="small" />,
        sourceName: 'files',
        section: 'erione_nav_more_admin'
      },
      {
        name: 'wo_aging',
        description: 'erione_nav_desc_wo_aging',
        link: '/app/analytics/work-orders/aging',
        icon: <QueryStatsTwoToneIcon fontSize="small" />,
        sourceName: 'wo_aging',
        section: 'erione_nav_more_reports'
      },
      {
        name: 'time_and_cost',
        description: 'erione_nav_desc_time_cost',
        link: '/app/analytics/work-orders/time-cost',
        icon: <PriceCheckTwoToneIcon fontSize="small" />,
        sourceName: 'time_and_cost',
        section: 'erione_nav_more_reports'
      },
      {
        name: 'reliability_dashboard',
        description: 'erione_nav_desc_reliability',
        link: '/app/analytics/assets/reliability',
        icon: <Inventory2TwoToneIcon fontSize="small" />,
        sourceName: 'reliability_dashboard',
        section: 'erione_nav_more_reports'
      },
      {
        name: 'total_maintenance_cost',
        description: 'erione_nav_desc_asset_cost',
        link: '/app/analytics/assets/cost',
        icon: <AnalyticsTwoToneIcon fontSize="small" />,
        sourceName: 'total_maintenance_cost',
        section: 'erione_nav_more_reports'
      }
    ]
  }
];

const hasVisibleSource = (items: MenuItem[], sourceName: string): boolean =>
  items.some((item) => {
    if (item.name === sourceName) {
      return true;
    }

    return item.items ? hasVisibleSource(item.items, sourceName) : false;
  });

function ErioneTopNav() {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasViewPermission, hasFeature, user } = useAuth();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeSection, setActiveSection] = useState<TopNavSection | null>(
    null
  );
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canShowItem = (item: MenuItem): boolean => {
    const hasPermission = item.permission
      ? hasViewPermission(item.permission)
      : true;
    const featured = item.planFeature ? hasFeature(item.planFeature) : true;
    const inUiConfig = user.uiConfiguration
      ? item.uiConfigKey
        ? user.uiConfiguration[item.uiConfigKey]
        : true
      : true;

    return hasPermission && featured && inUiConfig;
  };

  const visibleSections = useMemo(
    () =>
      menuItems
        .map((section) => ({
          ...section,
          items: section.items.filter(canShowItem)
        }))
        .filter((section) => section.items.length > 0),
    [hasViewPermission, hasFeature, user.uiConfiguration]
  );

  const visibleTopSections = useMemo(
    () =>
      curatedSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            visibleSections.some((visibleSection) =>
              hasVisibleSource(visibleSection.items, item.sourceName)
            )
          )
        }))
        .filter((section) => section.items.length > 0),
    [visibleSections]
  );

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleOpen = (
    event: MouseEvent<HTMLButtonElement>,
    section: TopNavSection
  ) => {
    clearCloseTimer();
    setAnchorEl(event.currentTarget);
    setActiveSection(section);
  };

  const handleClose = () => {
    clearCloseTimer();
    setAnchorEl(null);
    setActiveSection(null);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setAnchorEl(null);
      setActiveSection(null);
      closeTimerRef.current = null;
    }, 260);
  };

  const handleNavigate = (link: string) => {
    handleClose();
    navigate(link);
  };

  const renderTopNavItem = (item: TopNavEntry) => {
    return (
      <MuiMenuItem
        key={item.name}
        onClick={() => handleNavigate(item.link)}
        sx={{
          alignItems: 'flex-start',
          borderRadius: 1.5,
          gap: 1,
          mb: 0.5,
          px: 1.25,
          py: 1.1,
          whiteSpace: 'normal',
          '&:hover': {
            backgroundColor: alpha(ERIONE_VISUAL_IDENTITY.primary, 0.075),
            boxShadow: `inset 0 0 0 1px ${alpha(
              ERIONE_VISUAL_IDENTITY.primary,
              0.08
            )}`
          }
        }}
      >
        <ListItemIcon
          sx={{
            alignItems: 'center',
            backgroundColor: alpha(ERIONE_VISUAL_IDENTITY.primary, 0.08),
            borderRadius: 1,
            color: ERIONE_VISUAL_IDENTITY.primary,
            height: 30,
            justifyContent: 'center',
            minWidth: 32,
            width: 32
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={t(item.name)}
          secondary={t(item.description)}
          primaryTypographyProps={{ variant: 'body2', fontWeight: 700 }}
          secondaryTypographyProps={{
            variant: 'caption',
            color: 'text.secondary',
            sx: { display: 'block', lineHeight: 1.35, mt: 0.2 }
          }}
        />
        <ArrowForwardTwoToneIcon
          fontSize="small"
          sx={{ color: 'text.disabled', mt: 0.35 }}
        />
      </MuiMenuItem>
    );
  };

  const renderTopNavItems = (items: TopNavEntry[]) => {
    let currentSection: string | null = null;

    return items.map((item) => {
      const shouldRenderSection = item.section && item.section !== currentSection;
      currentSection = item.section ?? currentSection;

      return (
        <Box key={item.name}>
          {shouldRenderSection && (
            <Typography
              variant="overline"
              sx={{
                color: 'text.disabled',
                display: 'block',
                fontWeight: 700,
                px: 1.25,
                pt: 0.75
              }}
            >
              {t(item.section)}
            </Typography>
          )}
          {renderTopNavItem(item)}
        </Box>
      );
    });
  };

  return (
    <Box
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          handleClose();
        }
      }}
      sx={{
        display: { xs: 'none', lg: 'flex' },
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minWidth: 0,
        px: 2
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{
          p: 0.5,
          border: `1px solid ${alpha(ERIONE_VISUAL_IDENTITY.primary, 0.1)}`,
          borderRadius: 2,
          backgroundColor: alpha(theme.colors.alpha.trueWhite[100], 0.1),
          backdropFilter: 'blur(12px)',
          boxShadow: `0 8px 24px -20px ${alpha(
            ERIONE_VISUAL_IDENTITY.primaryDarker,
            0.45
          )}, inset 0 1px 0 ${alpha(
            theme.colors.alpha.trueWhite[100],
            0.16
          )}`
        }}
      >
        {visibleTopSections.map((section) => {
          const isActive = section.items.some((item) =>
            item.link.split('?')[0] === '/app/work-orders'
              ? location.pathname === '/app/work-orders'
              : location.pathname.startsWith(item.link.split('?')[0])
          );

          return (
            <Button
              key={section.heading}
              size="small"
              color={isActive ? 'primary' : 'secondary'}
              onClick={(event) => handleOpen(event, section)}
              onMouseEnter={(event) => handleOpen(event, section)}
              endIcon={<KeyboardArrowDownTwoToneIcon />}
              sx={{
                px: 1.4,
                borderRadius: 1.5,
                fontWeight: 700,
                backgroundColor: isActive
                  ? alpha(theme.colors.alpha.trueWhite[100], 0.16)
                  : 'transparent',
                color: isActive
                  ? theme.colors.alpha.trueWhite[100]
                  : alpha(theme.colors.alpha.trueWhite[100], 0.78),
                transition:
                  'background-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
                boxShadow: isActive
                  ? `inset 0 0 0 1px ${alpha(
                      ERIONE_VISUAL_IDENTITY.primary,
                      0.24
                    )}`
                  : 'none',
                '&:hover': {
                  backgroundColor: alpha(theme.colors.alpha.trueWhite[100], 0.14),
                  color: theme.colors.alpha.trueWhite[100],
                  boxShadow: `inset 0 0 0 1px ${alpha(
                    theme.colors.alpha.trueWhite[100],
                    0.18
                  )}`
                }
              }}
            >
              {t(section.heading)}
            </Button>
          );
        })}
      </Stack>

      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom"
        disablePortal
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 8]
            }
          }
        ]}
        sx={{ zIndex: theme.zIndex.appBar + 20 }}
      >
        <Paper
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
          sx={{
            p: 1,
            width: 390,
            borderRadius: 2.5,
            backgroundColor: alpha(theme.colors.alpha.white[100], 0.98),
            backdropFilter: 'blur(16px)',
            border: `1px solid ${alpha(ERIONE_VISUAL_IDENTITY.primary, 0.12)}`,
            boxShadow: `0 22px 58px ${alpha(
              ERIONE_VISUAL_IDENTITY.primaryDarker,
              0.16
            )}, 0 1px 0 ${alpha(ERIONE_VISUAL_IDENTITY.primary, 0.06)}`
          }}
        >
          {activeSection && (
            <>
              <Box sx={{ px: 1.25, py: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {activeSection.heading === 'erione_nav_more' && (
                    <MoreHorizTwoToneIcon color="primary" fontSize="small" />
                  )}
                  <Typography
                    variant="overline"
                    color="primary"
                    fontWeight={700}
                  >
                    {t(activeSection.heading)}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {t(activeSection.description)}
                </Typography>
              </Box>
              <Divider sx={{ mb: 0.75 }} />
              {renderTopNavItems(activeSection.items)}
            </>
          )}
        </Paper>
      </Popper>
    </Box>
  );
}

export default ErioneTopNav;
