import { Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Form from '../../components/form';
import * as Yup from 'yup';
import { IField } from '../../type';
import { useContext } from 'react';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import { StoreReturnType } from '../../../../store';
import { getErrorMessage } from '../../../../utils/api';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';

export interface CompleteWOFieldsConfig {
  feedback: boolean;
  signature: boolean;
  signerName?: boolean;
  signerDocument?: boolean;
  mileageTraveled?: boolean;
}

export interface CompleteWOValues {
  signature?: string;
  feedback?: string;
  signerName?: string;
  signerDocument?: string;
  mileageTraveled?: number;
}

interface SignatureProps {
  open: boolean;
  onClose: () => void;
  fieldsConfig: CompleteWOFieldsConfig;
  initialFeedback?: string;
  onComplete: (values: CompleteWOValues) => Promise<StoreReturnType>;
}
export default function CompleteWOModal({
  open,
  onClose,
  onComplete,
  fieldsConfig,
  initialFeedback
}: SignatureProps) {
  const { t }: { t: any } = useTranslation();
  const { uploadFiles } = useContext(CompanySettingsContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);

  const getFieldsAndShape = (): [Array<IField>, { [key: string]: any }] => {
    let fields: IField[] = [];
    let shape = {};
    if (fieldsConfig.feedback) {
      fields.push({
        name: 'feedback',
        type: 'text',
        label: t('feedback'),
        placeholder: t('feedback_description'),
        multiple: true
      });
      shape = { ...shape, feedback: Yup.string() };
    }
    // Campos exigidos pelo Tipo de Tarefa (Categoria da OS). So aparecem
    // quando a categoria marcou aquela obrigatoriedade - ver
    // WorkOrderCategory.requireSignerName/requireSignerDocument/requireMileage.
    if (fieldsConfig.signerName) {
      fields.push({
        name: 'signerName',
        type: 'text',
        label: t('signer_name')
      });
      shape = {
        ...shape,
        signerName: Yup.string().required(t('required_field'))
      };
    }
    if (fieldsConfig.signerDocument) {
      fields.push({
        name: 'signerDocument',
        type: 'text',
        label: t('signer_document')
      });
      shape = {
        ...shape,
        signerDocument: Yup.string().required(t('required_field'))
      };
    }
    if (fieldsConfig.mileageTraveled) {
      fields.push({
        name: 'mileageTraveled',
        type: 'number',
        label: t('mileage_traveled'),
        placeholder: t('km')
      });
      shape = {
        ...shape,
        mileageTraveled: Yup.number().required(t('required_field'))
      };
    }
    if (fieldsConfig.signature) {
      fields.push({
        name: 'signature',
        type: 'signature',
        label: t('signature')
      });
      shape = {
        ...shape,
        signature: Yup.string().required(t('required_signature'))
      };
    }
    return [fields, shape];
  };
  const formValues = initialFeedback ? { feedback: initialFeedback } : {};
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('close_wo')}
        </Typography>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          p: 3
        }}
      >
        <Form
          fields={getFieldsAndShape()[0]}
          validation={Yup.object().shape(getFieldsAndShape()[1])}
          submitText={t('close')}
          values={formValues}
          onChange={({ field, e }) => {}}
          onSubmit={async (values) => {
            return onComplete({
              signature: values.signature,
              feedback: values.feedback,
              signerName: values.signerName,
              signerDocument: values.signerDocument,
              mileageTraveled:
                values.mileageTraveled !== undefined &&
                values.mileageTraveled !== ''
                  ? Number(values.mileageTraveled)
                  : undefined
            })
              .then(onClose)
              .catch((err) => showSnackBar(getErrorMessage(err), 'error'));
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
