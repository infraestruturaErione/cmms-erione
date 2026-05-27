import { Box, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CustomFieldsManager from '../../../components/CustomFields/CustomFieldsManager';
import { CustomFieldEntityType } from '../../../../../models/owns/customField';
import { ERIONE_HIDDEN_MODULES } from '../../../../../config/erioneModules';

function MetersCustomFields() {
  const navigate = useNavigate();
  if (ERIONE_HIDDEN_MODULES.meters) {
    navigate('/app/settings/features');
    return null;
  }
  return <CustomFieldsManager entityType={CustomFieldEntityType.METER} />;
}

export default MetersCustomFields;
