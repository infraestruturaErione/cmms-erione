import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MultipleTabsLayout from '../components/MultipleTabsLayout';
import { TitleContext } from '../../../contexts/TitleContext';
import { useLocation, useParams } from 'react-router-dom';
import Vendors from './Vendors';
import Customers from './Customers';
import CustomerShow from './CustomerShow';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import PermissionErrorMessage from '../components/PermissionErrorMessage';
import { ERIONE_HIDDEN_MODULES } from '../../../config/erioneModules';

interface PropsType {}

const VendorsAndCustomers = ({}: PropsType) => {
  const { t }: { t: any } = useTranslation();

  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const { setTitle } = useContext(TitleContext);
  const { hasViewPermission, hasCreatePermission } = useAuth();
  const location = useLocation();

  const handleOpenAddModal = () => setOpenAddModal(true);
  const handleCloseAddModal = () => setOpenAddModal(false);
  const { customerId, vendorId } = useParams();

  // Vendors esta desabilitado no escopo atual da Erione
  // (ERIONE_HIDDEN_MODULES.vendors, ja usado pra ocultar o modulo em toda a
  // app sem tocar backend/rotas/permissoes). Nesse caso a experiencia de
  // Clientes fica sozinha, sem a barra de abas Fornecedores/Clientes nem o
  // titulo "Fornecedores e Clientes" - so "Clientes".
  const vendorsEnabled = !ERIONE_HIDDEN_MODULES.vendors;

  useEffect(() => {
    setTitle(
      vendorsEnabled
        ? t('Vendors_Customers')
        : t('customers_page_title', 'Clientes')
    );
  }, [vendorsEnabled]);

  const tabs = [
    { value: 'vendors', label: t('vendors') },
    { value: 'customers', label: t('customers') }
  ];
  const arr = location.pathname.split('/');
  const minus = customerId || vendorId ? 2 : 1;
  const tabIndex = tabs.findIndex(
    (tab) => tab.value === arr[arr.length - minus]
  );

  if (hasViewPermission(PermissionEntity.VENDORS_AND_CUSTOMERS)) {
    if (customerId && location.pathname.includes('/customers/')) {
      return <CustomerShow />;
    }

    if (!vendorsEnabled) {
      return <Customers />;
    }

    return (
      <MultipleTabsLayout
        basePath="/app/vendors-customers"
        tabs={tabs}
        tabIndex={tabIndex}
        title={t('Vendors_Customers')}
        action={
          hasCreatePermission(PermissionEntity.VENDORS_AND_CUSTOMERS)
            ? handleOpenAddModal
            : null
        }
        actionTitle={t(`${tabs[tabIndex].label}`)}
      >
        {tabIndex === 0 ? (
          <Vendors
            openModal={openAddModal}
            handleCloseModal={handleCloseAddModal}
          />
        ) : (
          <Customers />
        )}
      </MultipleTabsLayout>
    );
  } else
    return <PermissionErrorMessage message={'no_access_vendors_customers'} />;
};

export default VendorsAndCustomers;
