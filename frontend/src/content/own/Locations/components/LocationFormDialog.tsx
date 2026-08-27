import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import * as Yup from 'yup';
import Form from '../../components/form';
import { useDispatch } from '../../../../store';
import { addLocation, editLocation } from '../../../../slices/location';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import { googleMapsConfig } from '../../../../config';
import { handleFileUpload, getImageAndFiles } from '../../../../utils/overall';
import { formatSelectMultiple, formatCustomFields } from '../../../../utils/formatters';
import { getCustomFieldsValues } from '../../type';
import { CustomField } from '../../../../models/owns/customField';
import Location from '../../../../models/owns/location';
import {
  getLocationFormFields,
  getLocationFormShape
} from '../config/locationFormSchema';

export interface LocationFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  currentLocation?: Location;
  initialLocationName?: string;
  customFields: CustomField[];
  onCreateSuccess?: (createdLocation: Location) => void;
  onCreateFailure?: (err: any) => void;
  onEditSuccess?: () => void;
  onEditFailure?: (err: any) => void;
}

// Formulario unico de Endereco (create/edit) - Localizacao Pai/Trabalhadores/
// Equipes saem deste formulario (reforma do modal). No modo edit, esses 3
// campos entram como "undefined" no values (nao o valor cru do
// currentLocation), pra formatValues()/payload final NAO incluir essas
// chaves - assim o backend preserva as associacoes existentes em vez de
// zera-las (ver PATCH partial-update em customer/location).
function LocationFormDialog({
  mode,
  open,
  onClose,
  currentLocation,
  initialLocationName,
  customFields,
  onCreateSuccess,
  onCreateFailure,
  onEditSuccess,
  onEditFailure
}: LocationFormDialogProps) {
  const { t }: { t: any } = useTranslation();
  const dispatch = useDispatch();
  const { uploadFiles } = useContext(CompanySettingsContext);
  const { apiKey } = googleMapsConfig;

  const formatValues = (values) => {
    const newValues = { ...values };
    newValues.customers = formatSelectMultiple(newValues.customers);
    newValues.vendors = formatSelectMultiple(newValues.vendors);
    // Referencia Operacional (ID/PC) - referenceType vem do CustomSelect
    // como {label,value}, desembrulhado aqui pro valor puro que o backend
    // espera (enum como string). O payload SEMPRE inclui as duas chaves, e
    // referenceCode e' trimado mas NUNCA vira null aqui quando vazio -
    // continua "" (string vazia). Isso e' proposital: LocationService.
    // applyReferencePatch distingue "campo omitido" (referenceType=null E
    // referenceCode=null - usado por outros consumidores da API que nem
    // conhecem estes campos, preserva a referencia existente) de "pedido
    // explicito de limpeza" (referenceType=null E referenceCode="" - o que
    // este formulario sempre manda quando os dois campos ficam vazios, ja
    // que ele SEMPRE representa o estado final desejado, nunca "nao mexi
    // nisso"). Se este "|| null" virasse "|| ''", o formulario nunca
    // conseguiria limpar uma referencia existente - o backend leria como
    // "nao informado" e preservaria o valor antigo.
    newValues.referenceType = newValues.referenceType?.value || null;
    newValues.referenceCode = newValues.referenceCode?.trim() || '';
    const latitude =
      newValues.latitude !== undefined &&
      newValues.latitude !== null &&
      newValues.latitude !== ''
        ? Number(newValues.latitude)
        : newValues.coordinates?.lat;
    const longitude =
      newValues.longitude !== undefined &&
      newValues.longitude !== null &&
      newValues.longitude !== ''
        ? Number(newValues.longitude)
        : newValues.coordinates?.lng;
    newValues.latitude = latitude ?? null;
    newValues.longitude = longitude ?? null;
    return formatCustomFields(newValues);
  };

  const fields = getLocationFormFields({ t, apiKey, customFields });
  const shape = getLocationFormShape(t, customFields);

  const isEdit = mode === 'edit';

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isEdit ? t('edit_location') : t('add_location')}
        </Typography>
        <Typography variant="subtitle2">
          {isEdit ? t('edit_location_description') : t('add_location_description')}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Box>
          <Form
            fields={fields}
            validation={Yup.object().shape(
              shape,
              // referenceType e referenceCode dependem um do outro via
              // .when() (cada um exige o outro quando preenchido) - sem essa
              // 2a arg (par a excluir do grafo de dependencias), o Yup
              // detecta ciclo e lanca "Cyclic dependency" ja na construcao
              // do schema, derrubando a tela inteira. So' precisa excluir 1
              // das 2 arestas pra quebrar o ciclo.
              [['referenceType', 'referenceCode']]
            )}
            values={
              isEdit
                ? {
                    ...currentLocation,
                    parentLocation: undefined,
                    workers: undefined,
                    teams: undefined,
                    vendors: currentLocation?.vendors.map((vendor) => ({
                      label: vendor.companyName,
                      value: vendor.id
                    })),
                    customers: currentLocation?.customers.map((customer) => ({
                      label: customer.name,
                      value: customer.id
                    })),
                    referenceType: currentLocation?.referenceType
                      ? {
                          label: currentLocation.referenceType,
                          value: currentLocation.referenceType
                        }
                      : null,
                    referenceCode: currentLocation?.referenceCode || '',
                    latitude: currentLocation?.latitude,
                    longitude: currentLocation?.longitude,
                    coordinates: currentLocation?.longitude
                      ? {
                          lng: currentLocation.longitude,
                          lat: currentLocation.latitude
                        }
                      : null,
                    ...getCustomFieldsValues(currentLocation)
                  }
                : initialLocationName
                ? { name: initialLocationName }
                : {}
            }
            onChange={({ field, e }) => {}}
            onSubmit={async (values) => {
              let formattedValues = formatValues(values);
              try {
                if (isEdit) {
                  const imageAndFiles = await handleFileUpload(
                    {
                      files: formattedValues.files,
                      image: formattedValues.image
                    },
                    uploadFiles
                  );
                  formattedValues = {
                    ...formattedValues,
                    image: imageAndFiles.image,
                    files: imageAndFiles.files
                  };
                  await dispatch(editLocation(currentLocation.id, formattedValues));
                  onEditSuccess?.();
                } else {
                  const uploadedFiles = await uploadFiles(
                    formattedValues.files,
                    formattedValues.image
                  );
                  const imageAndFiles = getImageAndFiles(uploadedFiles);
                  formattedValues = {
                    ...formattedValues,
                    image: imageAndFiles.image,
                    files: imageAndFiles.files
                  };
                  const createdLocation = await dispatch(
                    addLocation(formattedValues)
                  );
                  onCreateSuccess?.(createdLocation);
                  return createdLocation;
                }
              } catch (err) {
                if (isEdit) {
                  onEditFailure?.(err);
                } else {
                  onCreateFailure?.(err);
                }
                throw err;
              }
            }}
            renderActions={(formik) => (
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="flex-end"
                spacing={1}
                width="100%"
              >
                <Button
                  color="secondary"
                  disabled={formik.isSubmitting}
                  onClick={onClose}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  onClick={() => formik.handleSubmit()}
                  startIcon={
                    formik.isSubmitting ? <CircularProgress size="1rem" /> : null
                  }
                  disabled={Boolean(formik.errors.submit) || formik.isSubmitting}
                >
                  {t('locations_save_button', 'Salvar endereço')}
                </Button>
              </Stack>
            )}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default LocationFormDialog;