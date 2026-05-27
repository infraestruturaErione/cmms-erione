import { Box, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CustomFieldsManager from '../../../components/CustomFields/CustomFieldsManager';
import { CustomFieldEntityType } from '../../../../../models/owns/customField';
import { ERIONE_HIDDEN_MODULES } from '../../../../../config/erioneModules';

function PartsCustomFields() {
  const navigate = useNavigate();
  if (ERIONE_HIDDEN_MODULES.parts) {
    navigate('/app/settings/features');
    return null;
  }
  return <CustomFieldsManager entityType={CustomFieldEntityType.PART} />;
}

export default PartsCustomFields;
