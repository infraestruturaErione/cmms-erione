import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import { ChangeEvent, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReplayTwoToneIcon from '@mui/icons-material/ReplayTwoTone';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import ClearTwoToneIcon from '@mui/icons-material/ClearTwoTone';
import useAuth from '../../../../hooks/useAuth';
import { useExport } from '../../../../hooks/useExport';
import { PermissionEntity } from '../../../../models/owns/role';
import { PlanFeature } from '../../../../models/owns/subscriptionPlan';
import { CustomSnackBarContext } from 'src/contexts/CustomSnackBarContext';
import SearchInput from '../../components/SearchInput';
import SplitButton from '../../components/SplitButton';
import { CustomerMiniDTO } from '../../../../models/owns/customer';

// Toolbar da tela /app/locations - so' UI/apresentacao (titulo, tabs,
// busca/filtro/contador, botao Novo endereco) - nenhum fetch/API aqui, so'
// callbacks recebidos por props pra quem tem o estado real (index.tsx /
// useLocationsSearch). Exportar/permissoes/useExport ficam encapsulados
// aqui por serem puramente de apresentacao desta barra.
export interface LocationsToolbarProps {
  currentTab: string;
  onTabsChange: (tab: string) => void;
  showMapTab: boolean;
  onRefresh: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchClear: () => void;
  customerFilter: CustomerMiniDTO | null;
  customersMini: CustomerMiniDTO[];
  onCustomerFilterChange: (customer: CustomerMiniDTO | null) => void;
  onClearCustomerFilter: () => void;
  hasBothFilters: boolean;
  onClearFilters: () => void;
  resultsCount: number;
  onOpenAddModal: () => void;
}

function LocationsToolbar({
  currentTab,
  onTabsChange,
  showMapTab,
  onRefresh,
  searchQuery,
  onSearchQueryChange,
  onSearchClear,
  customerFilter,
  customersMini,
  onCustomerFilterChange,
  onClearCustomerFilter,
  hasBothFilters,
  onClearFilters,
  resultsCount,
  onOpenAddModal
}: LocationsToolbarProps) {
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const {
    hasViewOtherPermission,
    hasCreatePermission,
    hasViewPermission,
    hasFeature
  } = useAuth();
  const { exportEntity, loadingExport } = useExport();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const tabs = [
    { value: 'list', label: t('list_view') },
    ...(showMapTab ? [{ value: 'map', label: t('map_view') }] : [])
  ];
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    onTabsChange(value);
  };

  return (
    <>
      <Box sx={{ mt: 0.5, mb: 1 }}>
        <Typography variant="h4" fontWeight={800}>
          {t('locations_web_page_title', 'Endereços')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'locations_page_subtitle',
            'Gerencie os endereços de atendimento dos clientes.'
          )}
        </Typography>
      </Box>
      <Box
        mb={0.25}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        {tabs.length > 1 ? (
          <Tabs
            onChange={handleTabsChange}
            value={currentTab}
            variant="scrollable"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36, py: 0.5 }
            }}
          >
            {tabs.map((tab) => (
              <Tab key={tab.value} label={tab.label} value={tab.value} />
            ))}
          </Tabs>
        ) : (
          <Box />
        )}
        <Stack direction={'row'} alignItems="center" spacing={1}>
          <IconButton onClick={onRefresh} color="primary" size="small">
            <ReplayTwoToneIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={(event) => setAnchorEl(event.currentTarget)}
            color="primary"
            size="small"
          >
            <MoreVertTwoToneIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      {currentTab === 'list' && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 1
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box sx={{ minWidth: 240, width: 320 }}>
              <SearchInput
                fullWidth
                size="small"
                value={searchQuery}
                placeholder={t(
                  'locations_search_placeholder',
                  'Buscar por ID, endereço ou cliente...'
                )}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onClear={onSearchClear}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Select
                size="small"
                displayEmpty
                value={customerFilter?.id ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  onCustomerFilterChange(
                    value === ''
                      ? null
                      : customersMini.find((c) => c.id === Number(value)) ||
                          null
                  );
                }}
                sx={{
                  minWidth: 180,
                  ...(customerFilter && {
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0
                  })
                }}
              >
                <MenuItem value="">
                  {t('locations_all_customers', 'Cliente: Todos')}
                </MenuItem>
                {customersMini.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </MenuItem>
                ))}
              </Select>
              {customerFilter && (
                <Tooltip
                  title={t(
                    'clear_customer_filter',
                    'Limpar filtro de cliente'
                  )}
                >
                  <IconButton
                    size="small"
                    onClick={onClearCustomerFilter}
                    sx={{
                      ml: '1px',
                      borderRadius: 1,
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      border: (theme) => `1px solid ${theme.palette.divider}`,
                      borderLeft: 'none',
                      height: 40
                    }}
                  >
                    <ClearTwoToneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {hasBothFilters && (
              <Button
                size="small"
                color="inherit"
                sx={{ color: 'text.secondary' }}
                startIcon={<ClearTwoToneIcon fontSize="small" />}
                onClick={onClearFilters}
              >
                {t('clear_filters', 'Limpar filtros')}
              </Button>
            )}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: 'nowrap' }}
            >
              {customerFilter ? `${customerFilter.name} · ` : ''}
              {t(
                'locations_results_count',
                '{{count}} endereços encontrados',
                { count: resultsCount }
              )}
            </Typography>
          </Box>
          {hasCreatePermission(PermissionEntity.LOCATIONS) && (
            <SplitButton
              onMainClick={onOpenAddModal}
              startIcon={<AddTwoToneIcon />}
              label={t('locations_new_address_button', 'Novo endereço')}
              menuItems={
                hasViewPermission(PermissionEntity.SETTINGS) &&
                hasFeature(PlanFeature.IMPORT_CSV)
                  ? [
                      {
                        label: t('to_import'),
                        onClick: () => navigate('/app/imports/locations')
                      }
                    ]
                  : []
              }
            />
          )}
        </Box>
      )}
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={openMenu}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{
          'aria-labelledby': 'basic-button'
        }}
      >
        {hasViewOtherPermission(PermissionEntity.LOCATIONS) && (
          <MenuItem
            disabled={loadingExport['locations']}
            onClick={async () => {
              try {
                await exportEntity('locations');
              } catch (error) {
                showSnackBar(t('Export failed'), 'error');
              }
            }}
          >
            <Stack spacing={2} direction="row">
              {loadingExport['locations'] && <CircularProgress size="1rem" />}
              <Typography>{t('to_export')}</Typography>
            </Stack>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export default LocationsToolbar;
