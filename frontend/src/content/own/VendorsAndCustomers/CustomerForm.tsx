import { Box, Button, CircularProgress, Stack } from '@mui/material';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';
import Form from '../components/form';
import { IField, getCustomFieldsIFields, getCustomFieldsRequiredShape, getCustomFieldsValues } from '../type';
import { Customer } from '../../../models/owns/customer';
import { CustomField, CustomFieldEntityType } from '../../../models/owns/customField';
import { emailRegExp, phoneRegExp, websiteRegExp } from '../../../utils/validators';
import { formatCustomFields, formatSelect } from '../../../utils/formatters';
import { FormikProps } from 'formik';

interface CustomerFormProps {
  customFields: CustomField[];
  initialValues?: Partial<Customer>;
  onSubmit: (values: any) => Promise<any>;
  submitText: string;
  renderActions?: (formik: FormikProps<any>) => ReactNode;
  renderTopActions?: (formik: FormikProps<any>) => ReactNode;
  hideBottomActions?: boolean;
  onCancel?: () => void;
}

const CustomerForm = ({
  customFields,
  initialValues,
  onSubmit,
  submitText,
  renderActions,
  renderTopActions,
  hideBottomActions,
  onCancel
}: CustomerFormProps) => {
  const { t }: { t: any } = useTranslation();

  const customerCustomFields = useMemo(
    () => getCustomFieldsIFields(customFields, CustomFieldEntityType.CUSTOMER),
    [customFields]
  );

  const formattedCustomFields = useMemo(
    () =>
      customerCustomFields.map((field) => ({
        ...field,
        midWidth: !field.multiple,
        fullWidth: Boolean(field.multiple),
        rows: field.multiple ? 4 : field.rows
      })),
    [customerCustomFields]
  );

  const fields: Array<IField> = useMemo(
    () => [
      {
        name: 'customerData',
        type: 'titleGroupField',
        label: t('customer_data', 'Dados do cliente')
      },
      {
        name: 'name',
        type: 'text',
        label: t('customer_name'),
        placeholder: 'John Doe',
        required: true
      },
      {
        name: 'city',
        type: 'text',
        label: t('city'),
        placeholder: t('city'),
        helperText: t('customer_city_helper'),
        midWidth: true
      },
      {
        name: 'cnpj',
        type: 'text',
        label: t('cnpj'),
        placeholder: t('cnpj_placeholder'),
        helperText: t('cnpj_optional_helper'),
        midWidth: true
      },
      {
        name: 'customerType',
        type: 'text',
        label: t('customer_type'),
        placeholder: t('customer_type_description')
      },
      {
        name: 'contact',
        type: 'titleGroupField',
        label: t('contact', 'Contato')
      },
      {
        name: 'phone',
        type: 'text',
        label: t('phone'),
        placeholder: '+212****3344',
        required: true,
        midWidth: true
      },
      {
        name: 'email',
        type: 'text',
        label: t('email'),
        placeholder: 'john.doe@gmail.com',
        midWidth: true
      },
      {
        name: 'website',
        type: 'text',
        label: t('website'),
        placeholder: 'https://web-site.com'
      },
      {
        name: 'addressSection',
        type: 'titleGroupField',
        label: t('address', 'Endereco')
      },
      {
        name: 'address',
        type: 'text',
        label: t('address'),
        placeholder: t('address')
      },
      {
        name: 'additionalInformation',
        type: 'titleGroupField',
        label: t('additional_information', 'Informacoes adicionais')
      },
      {
        name: 'description',
        type: 'text',
        label: t('description'),
        multiple: true,
        rows: 5,
        placeholder: t('customer_description_description'),
        fullWidth: true
      },
      ...formattedCustomFields
    ],
    [formattedCustomFields, t]
  );

  const validation = useMemo(
    () =>
      Yup.object().shape({
        name: Yup.string().required('required_customer_name'),
        ...getCustomFieldsRequiredShape(
          customFields,
          CustomFieldEntityType.CUSTOMER,
          t
        ),
        phone: Yup.string()
          .matches(phoneRegExp, t('invalid_phone'))
          .required(t('required_phone')),
        website: Yup.string()
          .matches(websiteRegExp, t('invalid_website'))
          .nullable(),
        email: Yup.string().matches(emailRegExp, t('invalid_email')).nullable()
      }),
    [customFields, t]
  );

  const values = useMemo(
    () => ({
      ...initialValues,
      billingCurrency: initialValues?.billingCurrency
        ? {
            label: initialValues.billingCurrency.name,
            value: initialValues.billingCurrency.id
          }
        : null,
      ...getCustomFieldsValues(initialValues)
    }),
    [initialValues]
  );

  const handleSubmit = async (rawValues) => {
    const formattedValues = formatCustomFields({
      ...rawValues,
      billingCurrency: formatSelect(rawValues.billingCurrency),
      rate:
        rawValues.rate === '' || rawValues.rate === null || rawValues.rate === undefined
          ? null
          : Number(rawValues.rate)
    });
    return onSubmit(formattedValues);
  };

  return (
    <Box sx={{ maxWidth: 920, mx: 'auto' }}>
      <Form
        fields={fields}
        validation={validation}
        submitText={submitText}
        values={values}
        onChange={() => {}}
        onSubmit={handleSubmit}
        renderTopActions={renderTopActions}
        hideBottomActions={hideBottomActions}
        midWidthBreakpoint="md"
        renderActions={
          renderActions
            ? renderActions
            : onCancel
            ? (formik) => (
                <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                  <Button onClick={onCancel} disabled={formik.isSubmitting}>
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
                    {t(submitText)}
                  </Button>
                </Stack>
              )
            : undefined
        }
      />
    </Box>
  );
};

export default CustomerForm;
