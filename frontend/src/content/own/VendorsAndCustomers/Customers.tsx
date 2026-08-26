import {
  Box,
  Button,
  Card,
  debounce,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { useContext, useMemo, useState } from 'react';
import CustomDatagrid2, {
  CustomDatagridColumn2
} from '../components/CustomDatagrid2';
import { Customer } from '../../../models/owns/customer';
import { useNavigate } from 'react-router-dom';
import {
  addCustomer,
  deleteCustomer,
  editCustomer,
  getCustomers
} from '../../../slices/customer';
import { useDispatch, useSelector } from '../../../store';
import ConfirmDialog from '../components/ConfirmDialog';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import { SearchCriteria } from '../../../models/owns/page';
import { onSearchQueryChange } from '../../../utils/overall';
import SearchInput from '../components/SearchInput';
import { createColumnHelper } from '@tanstack/react-table';
import useTableState from '../../../hooks/useTableState';
import { getErrorMessage } from '../../../utils/api';
import { getCustomFields } from '../../../slices/customField';
import CustomerForm from './CustomerForm';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';

interface PropsType {}

const fieldMapping: Record<string, string> = {
  name: 'name',
  cnpj: 'cnpj',
  phone: 'phone',
  email: 'email',
  customerType: 'customerType'
};

// Busca server-side via OR entre campos (mecanismo "alternatives" ja
// existente no SpecificationBuilder - cada FilterField "cn" ganha
// alternatives com o mesmo operador pros demais campos, sem exigir nenhuma
// mudanca de backend). Cobre nome/CNPJ/telefone/e-mail - nao inclui campos
// de billing (nao usamos).
const SEARCH_FIELDS: Array<keyof Customer> = ['name', 'cnpj', 'phone', 'email'];

const Customers = ({}: PropsType) => {
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { customers, loadingGet } = useSelector((state) => state.customers);
  const { customFields } = useSelector((state) => state.customFields);
  const [criteria, setCriteria] = useState<SearchCriteria>({
    filterFields: [],
    pageSize: 10,
    pageNum: 0,
    direction: 'DESC'
  });
  const [searchValue, setSearchValue] = useState('');

  const {
    sorting,
    setSorting,
    pagination,
    setPagination,
    columnOrder,
    setColumnOrder,
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    pinnedColumns,
    setPinnedColumns
  } = useTableState({
    prefix: 'customers',
    initialSorting: [],
    initialPagination: {
      pageSize: criteria.pageSize,
      pageIndex: criteria.pageNum
    },
    setCriteria,
    fieldMapping
  });
  const {
    hasEditPermission,
    hasDeletePermission,
    hasCreatePermission
  } = useAuth();
  const [currentCustomer, setCurrentCustomer] = useState<Customer>();
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const { showSnackBar } = useContext(CustomSnackBarContext);

  // Menu "..." por linha - anchorPosition (coordenadas capturadas no clique)
  // em vez de anchorEl, mesma correcao aplicada em Locations/index.tsx: um
  // anchorEl pode ficar orfao entre o clique e o efeito de posicionamento do
  // Popover quando o proprio clique dispara um re-render antes disso,
  // abrindo o menu no canto superior esquerdo em vez de ancorado na linha.
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{
    top: number;
    left: number;
    customer: Customer;
  } | null>(null);

  React.useEffect(() => {
    dispatch(getCustomers(criteria));
  }, [criteria]);

  React.useEffect(() => {
    if ((openAddModal || openUpdateModal) && !customFields.length) {
      dispatch(getCustomFields());
    }
  }, [openAddModal, openUpdateModal]);

  const onQueryChange = (event) => {
    setSearchValue(event.target.value);
    onSearchQueryChange<Customer>(
      event,
      criteria,
      setCriteria,
      [...SEARCH_FIELDS]
    );
  };
  const debouncedQueryChange = useMemo(() => debounce(onQueryChange, 400), [
    criteria
  ]);

  const onCreationSuccess = () => {
    setOpenAddModal(false);
    showSnackBar(t('customer_create_success'), 'success');
  };
  const onCreationFailure = (err) =>
    showSnackBar(getErrorMessage(err, t('customer_create_failure')), 'error');
  const onEditSuccess = () => {
    setOpenUpdateModal(false);
    showSnackBar(t('changes_saved_success'), 'success');
  };
  const onEditFailure = (err) =>
    showSnackBar(getErrorMessage(err, t('customer_edit_failure')), 'error');
  const onDeleteSuccess = () => {
    showSnackBar(t('customer_delete_success'), 'success');
  };
  const onDeleteFailure = (err) =>
    showSnackBar(getErrorMessage(err, t('customer_delete_failure')), 'error');

  const handleDelete = (id: number) => {
    dispatch(deleteCustomer(id)).then(onDeleteSuccess).catch(onDeleteFailure);
    setOpenDelete(false);
  };

  const columnHelper = createColumnHelper<Customer>();

  const columns: CustomDatagridColumn2<Customer>[] = [
    columnHelper.accessor('name', {
      id: 'name',
      header: () => t('customer', 'Cliente'),
      cell: (info) => (
        <Tooltip title={t('open_customer', 'Abrir cliente')}>
          <Box
            sx={{
              py: 1,
              width: 'fit-content',
              cursor: 'pointer',
              transition: 'color 120ms ease, text-decoration-color 120ms ease',
              '&:hover .customer-name': {
                color: 'primary.main',
                textDecoration: 'underline',
                textUnderlineOffset: '3px'
              }
            }}
            onClick={() =>
              navigate(`/app/vendors-customers/customers/${info.row.original.id}`)
            }
          >
            <Typography
              className="customer-name"
              sx={{ fontWeight: 700, fontSize: '0.95rem' }}
            >
              {info.getValue()}
            </Typography>
            {info.row.original.cnpj && (
              <Typography variant="caption" color="text.secondary">
                {info.row.original.cnpj}
              </Typography>
            )}
          </Box>
        </Tooltip>
      ),
      size: 260
    }),
    columnHelper.accessor('email', {
      id: 'email',
      header: () => t('contact', 'Contato'),
      cell: (info) => (
        <Typography variant="body2" color="text.secondary" noWrap>
          {info.getValue() || '--'}
        </Typography>
      ),
      size: 220
    }),
    columnHelper.accessor('phone', {
      id: 'phone',
      header: () => t('phone'),
      cell: (info) => info.getValue() || '--',
      size: 150
    }),
    columnHelper.accessor('customerType', {
      id: 'customerType',
      header: () => t('type', 'Tipo'),
      cell: (info) => info.getValue() || '--',
      size: 150
    }),
    columnHelper.display({
      id: 'actions',
      header: () => t('actions'),
      cell: ({ row }) => {
        const customer = row.original;
        const canEdit = hasEditPermission(
          PermissionEntity.VENDORS_AND_CUSTOMERS,
          customer
        );
        const canDelete = hasDeletePermission(
          PermissionEntity.VENDORS_AND_CUSTOMERS,
          customer
        );
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title={t('open_customer', 'Abrir cliente')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/app/vendors-customers/customers/${customer.id}`);
                }}
              >
                <OpenInNewTwoToneIcon fontSize="small" color="primary" />
              </IconButton>
            </Tooltip>
            {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
              <Tooltip title={t('create_wo', 'Criar OS')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(
                      `/app/work-orders?customer=${customer.id}&new=true`
                    );
                  }}
                >
                  <AssignmentTwoToneIcon fontSize="small" color="primary" />
                </IconButton>
              </Tooltip>
            )}
            {(canEdit || canDelete) && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRowMenuAnchor({
                    top: rect.bottom,
                    left: rect.right,
                    customer
                  });
                }}
              >
                <MoreVertTwoToneIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        );
      },
      size: 110
    })
  ];

  const renderRowMenu = () => {
    const rowCustomer = rowMenuAnchor?.customer;
    const canEdit =
      rowCustomer &&
      hasEditPermission(PermissionEntity.VENDORS_AND_CUSTOMERS, rowCustomer);
    const canDelete =
      rowCustomer &&
      hasDeletePermission(PermissionEntity.VENDORS_AND_CUSTOMERS, rowCustomer);
    return (
      <Menu
        open={Boolean(rowMenuAnchor)}
        onClose={() => setRowMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          rowMenuAnchor
            ? { top: rowMenuAnchor.top, left: rowMenuAnchor.left }
            : undefined
        }
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {canEdit && (
          <MenuItem
            onClick={() => {
              setCurrentCustomer(rowCustomer);
              setOpenUpdateModal(true);
              setRowMenuAnchor(null);
            }}
          >
            <EditTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="primary" />
            {t('edit')}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={() => {
              setCurrentCustomer(rowCustomer);
              setOpenDelete(true);
              setRowMenuAnchor(null);
            }}
          >
            <DeleteTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="error" />
            {t('to_delete')}
          </MenuItem>
        )}
      </Menu>
    );
  };

  const renderAddModal = () => (
    <Dialog
      fullWidth
      maxWidth="md"
      open={openAddModal}
      onClose={() => setOpenAddModal(false)}
    >
      <DialogTitle sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {t('add_customer')}
        </Typography>
        <Typography variant="subtitle2">
          {t('add_customer_description')}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Box>
          <CustomerForm
            customFields={customFields}
            submitText={'add'}
            initialValues={{}}
            onSubmit={async (values) =>
              dispatch(addCustomer(values))
                .then(onCreationSuccess)
                .catch(onCreationFailure)
            }
          />
        </Box>
      </DialogContent>
    </Dialog>
  );

  const renderUpdateModal = () => (
    <Dialog
      fullWidth
      maxWidth="md"
      open={openUpdateModal}
      onClose={() => setOpenUpdateModal(false)}
    >
      <DialogTitle sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {t('edit_customer', 'Editar cliente')}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Box>
          <CustomerForm
            customFields={customFields}
            submitText={'save'}
            initialValues={currentCustomer}
            onSubmit={async (values) =>
              dispatch(editCustomer(currentCustomer.id, values))
                .then(onEditSuccess)
                .catch(onEditFailure)
            }
          />
        </Box>
      </DialogContent>
    </Dialog>
  );

  return (
    <Box justifyContent="center" alignItems="stretch" paddingX={4}>
      <Box sx={{ mt: 0.5, mb: 0.5 }}>
        <Typography variant="h4" fontWeight={800}>
          {t('customers_page_title', 'Clientes')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'customers_page_subtitle',
            'Clientes e contratantes atendidos pela operação.'
          )}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          my: 1
        }}
      >
        <Box sx={{ minWidth: 260, flexGrow: 1, maxWidth: 380 }}>
          <SearchInput
            fullWidth
            size="small"
            placeholder={t('customers_search_placeholder', 'Buscar cliente...')}
            onChange={debouncedQueryChange}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t('customers_results_count', '{{count}} clientes encontrados', {
            count: customers.totalElements ?? 0
          })}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {hasCreatePermission(PermissionEntity.VENDORS_AND_CUSTOMERS) && (
          <Button
            variant="contained"
            startIcon={<AddTwoToneIcon />}
            onClick={() => setOpenAddModal(true)}
          >
            {t('new_customer', 'Novo cliente')}
          </Button>
        )}
      </Box>
      <Card
        sx={{
          display: 'flex',
          flexDirection: 'column',
          border: (theme) => `1px solid ${theme.palette.divider}`,
          boxShadow: 'none'
        }}
      >
        <CustomDatagrid2
          columns={columns}
          data={customers.content}
          loading={loadingGet}
          pagination={pagination}
          onPaginationChange={setPagination}
          totalRows={customers.totalElements}
          pageSizeOptions={[10, 25, 50, 100]}
          sorting={sorting}
          onSortingChange={setSorting}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          columnSizing={columnSizing}
          onColumnSizingChange={setColumnSizing}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          pinnedColumns={pinnedColumns}
          onPinnedColumnsChange={setPinnedColumns}
          onRowClick={(row) =>
            navigate(`/app/vendors-customers/customers/${row.id}`)
          }
          noRowsMessage={t('noRows.customer.message')}
          noRowsAction={t('noRows.customer.action')}
          headerBackgroundColor="#F7F8FA"
          autoHeight
          maxHeight={640}
        />
      </Card>

      {renderAddModal()}
      {renderUpdateModal()}
      {renderRowMenu()}
      <ConfirmDialog
        open={openDelete}
        onCancel={() => setOpenDelete(false)}
        onConfirm={() => handleDelete(currentCustomer?.id)}
        confirmText={t('to_delete')}
        question={t('confirm_delete_customer')}
      />
    </Box>
  );
};

export default Customers;
