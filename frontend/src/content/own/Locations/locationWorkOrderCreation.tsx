import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CustomerMiniDTO } from '../../../models/owns/customer';

// Regra unica de "Criar OS a partir de um Location" - reutilizada por
// /app/locations (lista) e /app/locations/:id (Stage 3). NUNCA
// customers[0] silencioso: 0 ou 1 Customer abre direto, 2+ pede escolha
// explicita antes de navegar. Extraida aqui pra nao duplicar a logica entre
// as duas telas (pedido explicito da Stage 3, item 17).
export interface LocationForWorkOrderCreation {
  id: number;
  name: string;
  customers?: CustomerMiniDTO[];
}

export const getLocationWorkOrderUrl = (
  locationId: number,
  customerId?: number
) =>
  customerId
    ? `/app/work-orders?customer=${customerId}&location=${locationId}&new=true`
    : `/app/work-orders?location=${locationId}&new=true`;

export function useLocationWorkOrderCreation() {
  const navigate = useNavigate();
  const [dialogLocation, setDialogLocation] =
    useState<LocationForWorkOrderCreation | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>(
    ''
  );

  const createWorkOrder = (location: LocationForWorkOrderCreation) => {
    const customers = location.customers || [];
    if (customers.length <= 1) {
      navigate(getLocationWorkOrderUrl(location.id, customers[0]?.id));
      return;
    }
    setSelectedCustomerId('');
    setDialogLocation(location);
  };

  const confirm = () => {
    if (!dialogLocation || !selectedCustomerId) return;
    navigate(
      getLocationWorkOrderUrl(dialogLocation.id, Number(selectedCustomerId))
    );
    setDialogLocation(null);
  };

  const cancel = () => setDialogLocation(null);

  return {
    dialogLocation,
    selectedCustomerId,
    setSelectedCustomerId,
    createWorkOrder,
    confirm,
    cancel
  };
}

// Dialogo compartilhado - so precisa do estado devolvido pelo hook acima.
export function CreateWorkOrderCustomerDialog({
  dialogLocation,
  selectedCustomerId,
  setSelectedCustomerId,
  onConfirm,
  onCancel
}: {
  dialogLocation: LocationForWorkOrderCreation | null;
  selectedCustomerId: number | '';
  setSelectedCustomerId: (id: number | '') => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t }: { t: any } = useTranslation();
  return (
    <Dialog open={Boolean(dialogLocation)} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t('select_customer_for_wo', 'Qual cliente para esta OS?')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'select_customer_for_wo_helper',
            '{{name}} está vinculado a mais de um cliente - escolha qual usar.',
            { name: dialogLocation?.name }
          )}
        </Typography>
        <Select
          fullWidth
          size="small"
          displayEmpty
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value as number)}
        >
          <MenuItem value="" disabled>
            {t('select_customer', 'Selecionar cliente')}
          </MenuItem>
          {dialogLocation?.customers?.map((customer) => (
            <MenuItem key={customer.id} value={customer.id}>
              {customer.name}
            </MenuItem>
          ))}
        </Select>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('cancel')}</Button>
        <Button
          variant="contained"
          disabled={!selectedCustomerId}
          onClick={onConfirm}
        >
          {t('continue', 'Continuar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
