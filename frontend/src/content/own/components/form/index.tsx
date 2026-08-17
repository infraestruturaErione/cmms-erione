import {
  Box,
  Button,
  CircularProgress,
  Grid,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import { Formik, FormikProps } from 'formik';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FormikErrorFocus from 'formik-error-focus';
import * as Yup from 'yup';
import { ObjectSchema } from 'yup';
import { IField, IHash } from '../../type';
import CheckBoxForm from './CheckBoxForm';
import Field from './Field';
import FileUpload from '../FileUpload';
import DateTimePicker from '@mui/lab/DateTimePicker';
import CustomSwitch from './CustomSwitch';
import SelectMapCoordinates from './SelectMapCoordinates';
import SelectPartQuantities from './SelectPartQuantities';
import { CustomSelect } from './CustomSelect2';
import SignaturePad from './SignaturePad';
import DateRangePicker from './DateRangePicker';
import { parseApiDate } from '../../../../utils/dateTime';

interface PropsType {
  fields: Array<IField>;
  values?: IHash<any>;
  onSubmit?: (values: IHash<any>) => Promise<any>;
  onCanceled?: () => void;
  onChange?: any;
  submitText?: string;
  validation?: ObjectSchema<any>;
  isLoading?: boolean;
  isButtonEnabled?: (values: IHash<any>, ...props: any[]) => boolean;
  renderActions?: (formik: FormikProps<IHash<any>>) => ReactNode;
  renderTopActions?: (formik: FormikProps<IHash<any>>) => ReactNode;
  hideBottomActions?: boolean;
  midWidthBreakpoint?: 'md' | 'lg';
}

export default (props: PropsType) => {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const midWidthBreakpoint = props.midWidthBreakpoint ?? 'lg';

  const validationSchema = useMemo(() => {
    if (props.validation) return props.validation;

    const shape: IHash<any> = {};
    props.fields.forEach((f) => {
      shape[f.name] = Yup.string();
      if (f.required) {
        shape[f.name] = shape[f.name].required();
      }
    });

    return Yup.object().shape(shape);
  }, [props.fields, props.validation]);

  const handleChange = (formik: FormikProps<IHash<any>>, field: string, e) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    props.onChange && props.onChange({ field, e });
    if (props.fields.length == 1) {
      formik.setFieldTouched(field, true);
    }
    formik.setFieldValue(field, e);

    // Cascata: limpa os campos dependentes para nao sobrar um id de um contexto
    // anterior (ex.: trocar de cliente nao pode manter local/ativo do cliente antigo).
    props.fields
      .find((f) => f.name === field)
      ?.clearsOnChange?.forEach((dependentField) => {
        formik.setFieldValue(dependentField, null);
        formik.setFieldTouched(dependentField, false);
      });

    return formik.handleChange(field);
  };

  const handleKeyDown =
    (formik: FormikProps<IHash<any>>, multiple: boolean) =>
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !multiple) {
        e.preventDefault();
        formik.handleSubmit();
      }
    };

  const filterRelatedFields = (fields: IField[], formik): IField[] => {
    const fieldsClone = [...fields];
    const withRelatedFields = fields.filter(
      (field) => field.relatedFields?.length
    );
    withRelatedFields.forEach(({ relatedFields, name, type }) => {
      relatedFields.forEach((relatedField) => {
        if (
          formik.values[name] === relatedField.value ||
          formik.values[name]?.value === relatedField.value ||
          (type === 'switch' &&
            formik.values[name] &&
            (formik.values[name][0] === 'on') === relatedField.value) ||
          (formik.values[name] === undefined && !relatedField.value)
        ) {
          if (relatedField.hide) {
            const fieldToDeleteIndex = fieldsClone.findIndex(
              (field) => field.name === relatedField.field
            );
            fieldsClone.splice(fieldToDeleteIndex, 1);
          }
        }
      });
    });
    return fieldsClone;
  };
  return (
    <>
      <Formik<IHash<any>>
        validationSchema={validationSchema}
        validateOnChange={false}
        validateOnBlur={false}
        initialValues={props.values || {}}
        onSubmit={(
          values,
          { resetForm, setErrors, setStatus, setSubmitting }
        ) => {
          setSubmitting(true);
          props.onSubmit(values).finally(() => {
            // resetForm();
            setStatus({ success: true });
            setSubmitting(false);
          });
        }}
      >
        {(formik) => (
          <Grid container spacing={2}>
            {props.renderTopActions && (
              <Grid item xs={12}>
                {props.renderTopActions(formik)}
              </Grid>
            )}
            {filterRelatedFields(props.fields, formik).map((field, index) => {
              const gridWidthProps = field.midWidth
                ? midWidthBreakpoint === 'md'
                  ? { md: 6 }
                  : { lg: 6 }
                : {};
              return (
                <Grid
                  item
                  xs={12}
                  {...gridWidthProps}
                  key={field.name}
                >
                  {field.type === 'select' ? (
                    <CustomSelect field={field} handleChange={handleChange} />
                  ) : field.type === 'checkbox' ? (
                    <CheckBoxForm
                      label={field.label}
                      onChange={(e) => {
                        handleChange(formik, field.name, e.target.checked);
                      }}
                      checked={formik.values[field.name]}
                    />
                  ) : field.type === 'groupCheckbox' ? (
                    <CheckBoxForm
                      label={field.label}
                      type="groupCheckbox"
                      listCheckbox={field.items}
                      key={field.name}
                    />
                  ) : field.type === 'switch' ? (
                    <CustomSwitch
                      title={field.label}
                      description={field.helperText}
                      name={field.name}
                      handleChange={formik.handleChange}
                      checked={formik.values[field.name]}
                      // field.compact e' opcional/retrocompativel - undefined
                      // mantem sx/titleSx como undefined, ou seja, o mesmo
                      // visual de sempre (h6 bold + mb:2) em todas as outras
                      // telas que usam type:'switch'.
                      sx={
                        field.compact
                          ? {
                              mb: 0,
                              p: 1.25,
                              borderRadius: 1.5,
                              border: `1px solid ${theme.colors.alpha.black[10]}`,
                              backgroundColor: theme.colors.alpha.white[100]
                            }
                          : undefined
                      }
                      titleSx={
                        field.compact
                          ? { typography: 'body1', fontWeight: 700 }
                          : undefined
                      }
                      // Este CustomSwitch ja esta dentro do <Grid item> logo
                      // acima (linha ~138) - sem isso, o <Grid item> proprio
                      // do CustomSwitch fica aninhado direto dentro de outro
                      // <Grid item>, herda as CSS vars de spacing do
                      // container e duplica o gutter, o que so quebra
                      // visualmente quando o campo e' midWidth (por isso
                      // reaproveita o mesmo field.compact).
                      disableGridItem={field.compact}
                    />
                  ) : field.type === 'titleGroupField' ? (
                    <Typography variant="h3" sx={{ pb: 1 }}>
                      {t(`${field.label}`)}
                    </Typography>
                  ) : field.type === 'file' ? (
                    <Box>
                      <FileUpload
                        multiple={field.multiple}
                        title={field.label}
                        type={field.fileType || 'file'}
                        variant={field.fileVariant}
                        description={t('upload')}
                        files={
                          Array.isArray(formik.values[field.name])
                            ? formik.values[field.name]
                            : formik.values[field.name]
                            ? [formik.values[field.name]]
                            : []
                        }
                        onDrop={(files) => {
                          formik.setFieldValue(field.name, files);
                        }}
                        error={formik.errors[field.name] || field.error}
                      />
                    </Box>
                  ) : field.type === 'date' ? (
                    <Box>
                      <Box pb={1}>
                        <b>{field.label}:</b>
                      </Box>
                      <DateTimePicker
                        value={parseApiDate(formik.values[field.name])}
                        onChange={(newValue) => {
                          handleChange(formik, field.name, newValue);
                        }}
                        inputFormat="dd/MM/yyyy HH:mm"
                        ampm={false}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            placeholder={t('select_date')}
                            required={field?.required}
                            error={!!formik.errors[field.name] || field.error}
                            helperText={
                              typeof formik.errors[field.name] === 'string'
                                ? (formik.errors[field.name] as string)
                                : ''
                            }
                          />
                        )}
                      />
                    </Box>
                  ) : field.type === 'dateRange' ? (
                    <Box>
                      <Box pb={1}>
                        <b>{field.label}:</b>
                      </Box>
                      <DateRangePicker
                        value={formik.values[field.name]}
                        onChange={(range) => {
                          handleChange(formik, field.name, range);
                        }}
                        fullWidth
                        placeholder={t('select_date_range')}
                        required={field?.required}
                        error={!!formik.errors[field.name] || field.error}
                        helperText={
                          typeof formik.errors[field.name] === 'string'
                            ? (formik.errors[field.name] as string)
                            : ''
                        }
                      />
                    </Box>
                  ) : field.type === 'coordinates' ? (
                    <SelectMapCoordinates
                      selected={formik.values[field.name]}
                      onChange={(coordinates) => {
                        if (
                          props.fields.some(({ name }) => name === 'latitude')
                        ) {
                          formik.setFieldValue(
                            'latitude',
                            coordinates?.lat ?? ''
                          );
                        }
                        if (
                          props.fields.some(({ name }) => name === 'longitude')
                        ) {
                          formik.setFieldValue(
                            'longitude',
                            coordinates?.lng ?? ''
                          );
                        }
                        handleChange(formik, field.name, coordinates);
                      }}
                    />
                  ) : field.type === 'partQuantity' ? (
                    <SelectPartQuantities
                      selected={formik.values[field.name] ?? []}
                      onChange={(newPartQuantities) => {
                        handleChange(formik, field.name, newPartQuantities);
                      }}
                    />
                  ) : field.type === 'signature' ? (
                    <SignaturePad
                      label={field.label}
                      value={formik.values[field.name]}
                      onChange={(signature) => {
                        formik.setFieldValue(field.name, signature);
                      }}
                    />
                  ) : (
                    <Field
                      key={index}
                      {...field}
                      isDisabled={formik.isSubmitting}
                      type={field.type}
                      label={field.label}
                      placeholder={field.placeholder}
                      value={formik.values[field.name]}
                      onBlur={formik.handleBlur}
                      // onChange={formik.handleChange}
                      onChange={(e) => {
                        handleChange(formik, field.name, e.target.value);
                      }}
                      onKeyDown={handleKeyDown(formik, field.multiple)}
                      error={!!formik.errors[field.name] || field.error}
                      errorMessage={formik.errors[field.name]}
                      fullWidth={field.fullWidth}
                    />
                  )}
                </Grid>
              );
            })}

            {!props.hideBottomActions && (
              <Grid item xs={12}>
                {props.renderActions ? (
                  props.renderActions(formik)
                ) : (
                  <>
                    <Button
                      type="submit"
                      sx={{
                        mt: { xs: 2, sm: 0 }
                      }}
                      onClick={() => formik.handleSubmit()}
                      variant="contained"
                      startIcon={
                        formik.isSubmitting ? (
                          <CircularProgress size="1rem" />
                        ) : null
                      }
                      disabled={
                        Boolean(formik.errors.submit) || formik.isSubmitting
                      }
                    >
                      {t(props.submitText)}
                    </Button>

                    {props.onCanceled && (
                      <Button
                        sx={{
                          mt: { xs: 2, sm: 0 }
                        }}
                        onClick={() => props.onCanceled}
                        variant="outlined"
                        disabled
                      >
                        {t(props.submitText)}
                      </Button>
                    )}
                  </>
                )}
              </Grid>
            )}
            <FormikErrorFocus
              // See scroll-to-element for configuration options: https://www.npmjs.com/package/scroll-to-element
              offset={0}
              align={'bottom'}
              focusDelay={200}
              ease={'linear'}
              duration={500}
              formik={formik}
            />
          </Grid>
        )}
      </Formik>
    </>
  );
};
