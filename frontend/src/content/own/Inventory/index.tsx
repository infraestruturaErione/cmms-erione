import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MultipleTabsLayout from '../components/MultipleTabsLayout';
import { TitleContext } from '../../../contexts/TitleContext';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sets from './Sets';
import PermissionErrorMessage from '../components/PermissionErrorMessage';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import SplitButton from '../components/SplitButton';
import * as React from 'react';

interface PropsType {}

const Inventory = ({}: PropsType) => {
  const { t }: { t: any } = useTranslation();
  const [action, setAction] = useState<() => void>();
  const { setTitle } = useContext(TitleContext);
  const { setId } = useParams();
  const { hasViewPermission, hasCreatePermission } = useAuth();

  useEffect(() => {
    setTitle(t('sets_of_parts'));
  }, []);

  if (hasViewPermission(PermissionEntity.PARTS_AND_MULTIPARTS))
    return (
      <MultipleTabsLayout
        basePath={`/app/inventory`}
        tabs={[{ value: 'sets', label: t('sets_of_parts') }]}
        tabIndex={0}
        title={t('sets_of_parts')}
        rawAction={
          <SplitButton
            onMainClick={
              hasCreatePermission(PermissionEntity.PARTS_AND_MULTIPARTS)
                ? action
                : null
            }
            startIcon={<AddTwoToneIcon />}
            label={t('sets_of_parts')}
            menuItems={[]}
          />
        }
      >
        <Sets setAction={setAction} />
      </MultipleTabsLayout>
    );
  else return <PermissionErrorMessage message={'no_access_inventory'} />;
};

export default Inventory;
