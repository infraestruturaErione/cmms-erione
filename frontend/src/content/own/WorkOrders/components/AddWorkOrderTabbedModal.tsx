import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DateTimePicker from '@mui/lab/DateTimePicker';
import { FormikProps } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';
import { ObjectSchema } from 'yup';
import Form from '../../components/form';
import Field from '../../components/form/Field';
import CustomSwitch from '../../components/form/CustomSwitch';
import { CustomSelect } from '../../components/form/CustomSelect2';
import FileUpload from '../../components/FileUpload';
import { IField, IHash } from '../../type';
import { useSelector } from '../../../../store';
import { useBrand } from '../../../../hooks/useBrand';
import { ERIONE_VISUAL_IDENTITY } from '../../../../config/erioneVisualIdentity';
import { ERIONE_TIME_ZONE, parseApiDate } from '../../../../utils/dateTime';
import { getLocationAddressWithReference } from '../../../../utils/locationDisplay';
import useAuth from '../../../../hooks/useAuth';
import EstimatedStartDateField from './EstimatedStartDateField';
import {
  ESTIMATED_START_TIME_FIELD,
  resolveEstimatedStart
} from '../../../../utils/estimatedStartDate';
import {
  getServerNow,
  hasServerClock,
  syncServerClock
} from '../../../../utils/serverClock';
import Location, { LocationMiniDTO } from '../../../../models/owns/location';
import LocationMiniMap from '../Details/LocationMiniMap';
import {
  getWorkOrderAssignmentValues,
  WorkOrderAssignmentMode
} from './workOrderAssignment';

const BRAND = ERIONE_VISUAL_IDENTITY;
const UI_COLLABORATORS_FIELD = '__selectedCollaborators';
const UI_TEAM_FIELD = '__selectedTeam';

type AssignmentMode = WorkOrderAssignmentMode;
type HandleFormChange = (
  formik: FormikProps<IHash<any>>,
  field: string,
  value: any
) => any;

interface PropsType {
  open: boolean;
  onClose: () => void;
  fields: IField[];
  validation: ObjectSchema<any>;
  values: IHash<any>;
  onSubmit: (values: IHash<any>) => Promise<any>;
  onChange?: any;
  submitText: string;
}

const ATTACHMENT_FIELD_NAMES = new Set(['files', 'image']);
const OMITTED_CREATE_FIELDS = new Set([
  'asset',
  'assetStatus',
  'dueDate',
  'estimatedDuration',
  'tasks'
]);

function FieldControl({
  field,
  formik,
  handleChange
}: {
  field?: IField;
  formik: FormikProps<IHash<any>>;
  handleChange: HandleFormChange;
}) {
  const { t }: { t: any } = useTranslation();
  if (!field) return null;

  if (field.type === 'select') {
    return <CustomSelect field={field} handleChange={handleChange} />;
  }

  if (field.type === 'date') {
    return (
      <DateTimePicker
        value={parseApiDate(formik.values[field.name])}
        onChange={(newValue) => handleChange(formik, field.name, newValue)}
        inputFormat="dd/MM/yyyy HH:mm"
        ampm={false}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            label={field.label}
            placeholder={t('select_date')}
            required={field.required}
            error={Boolean(formik.errors[field.name]) || field.error}
            helperText={
              typeof formik.errors[field.name] === 'string'
                ? (formik.errors[field.name] as string)
                : field.helperText
                ? t(field.helperText)
                : ''
            }
          />
        )}
      />
    );
  }

  if (field.type === 'file') {
    const files = Array.isArray(formik.values[field.name])
      ? formik.values[field.name]
      : formik.values[field.name]
      ? [formik.values[field.name]]
      : [];
    return (
      <FileUpload
        multiple={field.multiple}
        title={field.label}
        type={field.fileType || 'file'}
        variant="light"
        description={t('upload')}
        files={files}
        disabled={formik.isSubmitting}
        onDrop={(newFiles) => formik.setFieldValue(field.name, newFiles)}
        error={
          typeof formik.errors[field.name] === 'string'
            ? (formik.errors[field.name] as string)
            : field.error
        }
      />
    );
  }

  return (
    <Field
      {...field}
      value={formik.values[field.name]}
      onBlur={formik.handleBlur}
      onChange={(event) => handleChange(formik, field.name, event.target.value)}
      error={Boolean(formik.errors[field.name]) || field.error}
      errorMessage={formik.errors[field.name]}
      isDisabled={formik.isSubmitting}
      fullWidth
    />
  );
}

function AssignmentFields({
  formik,
  handleChange,
  mode,
  onModeChange,
  primaryUserField,
  assignedToField,
  teamField
}: {
  formik: FormikProps<IHash<any>>;
  handleChange: HandleFormChange;
  mode: AssignmentMode;
  onModeChange: (mode: AssignmentMode) => void;
  primaryUserField?: IField;
  assignedToField?: IField;
  teamField?: IField;
}) {
  const { t }: { t: any } = useTranslation();
  const collaboratorsAvailable = Boolean(primaryUserField || assignedToField);
  const teamAvailable = Boolean(teamField);

  if (!collaboratorsAvailable && !teamAvailable) return null;

  const selectedCollaborators = Array.isArray(
    formik.values[UI_COLLABORATORS_FIELD]
  )
    ? formik.values[UI_COLLABORATORS_FIELD]
    : [];
  const selectedTeam = formik.values[UI_TEAM_FIELD] ?? null;

  const applyCollaborators = (collaborators: any[]) => {
    const assignment = getWorkOrderAssignmentValues(
      'COLLABORATORS',
      collaborators,
      selectedTeam
    );
    if (primaryUserField) {
      formik.setFieldValue('primaryUser', assignment.primaryUser, false);
    }
    if (assignedToField) {
      formik.setFieldValue(
        'assignedTo',
        primaryUserField ? assignment.assignedTo : collaborators,
        false
      );
    }
    if (teamField) formik.setFieldValue('team', assignment.team, false);
  };

  const applyTeam = (team: any) => {
    const assignment = getWorkOrderAssignmentValues('TEAM', [], team ?? null);
    if (primaryUserField) {
      formik.setFieldValue('primaryUser', assignment.primaryUser, false);
    }
    if (assignedToField) {
      formik.setFieldValue('assignedTo', assignment.assignedTo, false);
    }
    if (teamField) formik.setFieldValue('team', assignment.team, false);
  };

  const handleModeChange = (nextMode: AssignmentMode) => {
    onModeChange(nextMode);
    if (nextMode === 'COLLABORATORS') {
      applyCollaborators(selectedCollaborators);
    } else {
      applyTeam(selectedTeam);
    }
  };

  const collaboratorsField: IField = {
    ...(assignedToField || primaryUserField),
    name: UI_COLLABORATORS_FIELD,
    label: t('wo_add_collaborators'),
    placeholder: t('wo_add_select_collaborators'),
    type: 'select',
    type2: 'user',
    multiple: Boolean(assignedToField),
    required: Boolean(primaryUserField?.required || assignedToField?.required),
    error: formik.errors.primaryUser || formik.errors.assignedTo
  };
  const selectedTeamField: IField = {
    ...teamField,
    name: UI_TEAM_FIELD,
    label: t('team'),
    placeholder: t('select_team'),
    type: 'select',
    type2: 'team',
    required: Boolean(teamField?.required),
    error: formik.errors.team
  };

  const assignmentHandleChange: HandleFormChange = (
    currentFormik,
    fieldName,
    nextValue
  ) => {
    handleChange(currentFormik, fieldName, nextValue);
    if (fieldName === UI_COLLABORATORS_FIELD) {
      const collaborators = Array.isArray(nextValue)
        ? nextValue
        : nextValue
        ? [nextValue]
        : [];
      if (mode === 'COLLABORATORS') applyCollaborators(collaborators);
    } else if (fieldName === UI_TEAM_FIELD && mode === 'TEAM') {
      applyTeam(nextValue);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {t('wo_add_assignment_title')}
      </Typography>
      {collaboratorsAvailable && teamAvailable && (
        <RadioGroup
          row
          value={mode}
          onChange={(event) =>
            handleModeChange(event.target.value as AssignmentMode)
          }
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))'
            },
            mb: 1.25,
            mt: 1,
            p: 0.5,
            gap: 0.5,
            borderRadius: 1.5,
            backgroundColor: alpha(BRAND.primary, 0.045),
            '& .MuiFormControlLabel-root': {
              m: 0,
              px: 1,
              py: 0.9,
              minWidth: 0,
              borderRadius: 1,
              border: '1px solid transparent'
            },
            '& .MuiRadio-root': { p: 0, mr: 1 },
            '& .MuiFormControlLabel-label': { fontSize: 14, lineHeight: 1.4 }
          }}
        >
          <FormControlLabel
            value="COLLABORATORS"
            control={<Radio size="small" />}
            label={t('wo_add_collaborator_mode')}
            sx={
              mode === 'COLLABORATORS'
                ? {
                    backgroundColor: 'background.paper',
                    borderColor: `${alpha(BRAND.primary, 0.2)} !important`,
                    color: BRAND.primary,
                    '& .MuiFormControlLabel-label': { fontWeight: 700 },
                    boxShadow: `0 2px 5px ${alpha(BRAND.primaryDark, 0.04)}`
                  }
                : undefined
            }
          />
          <FormControlLabel
            value="TEAM"
            control={<Radio size="small" />}
            label={t('team')}
            sx={
              mode === 'TEAM'
                ? {
                    backgroundColor: 'background.paper',
                    borderColor: `${alpha(BRAND.primary, 0.2)} !important`,
                    color: BRAND.primary,
                    '& .MuiFormControlLabel-label': { fontWeight: 700 },
                    boxShadow: `0 2px 5px ${alpha(BRAND.primaryDark, 0.04)}`
                  }
                : undefined
            }
          />
        </RadioGroup>
      )}
      {mode === 'COLLABORATORS' && collaboratorsAvailable ? (
        <FieldControl
          field={collaboratorsField}
          formik={formik}
          handleChange={assignmentHandleChange}
        />
      ) : teamAvailable ? (
        <FieldControl
          field={selectedTeamField}
          formik={formik}
          handleChange={assignmentHandleChange}
        />
      ) : null}
    </Box>
  );
}

function LocationPreview({
  location
}: {
  location: LocationMiniDTO | Location;
}) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapsHref = hasCoordinates
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : location.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(location.address)}`
    : null;

  return (
    <Box
      sx={{
        mt: -0.75,
        p: 1.25,
        borderRadius: 1.5,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: alpha(BRAND.primary, 0.025)
      }}
    >
      <Stack
        direction="column"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: hasCoordinates ? 1 : 0 }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          spacing={0.75}
          minWidth={0}
        >
          <PlaceRoundedIcon
            sx={{ mt: 0.15, fontSize: 18, color: BRAND.primary, flexShrink: 0 }}
          />
          <Box minWidth={0}>
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {location.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {getLocationAddressWithReference(location) ||
                t('wo_add_destination_no_address')}
            </Typography>
          </Box>
        </Stack>
        {mapsHref && (
          <Link
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            variant="caption"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              flexShrink: 0,
              fontWeight: 700
            }}
          >
            {t('wo_add_open_in_maps')}
            <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
          </Link>
        )}
      </Stack>
      {hasCoordinates && (
        <LocationMiniMap
          latitude={latitude}
          longitude={longitude}
          height={150}
        />
      )}
    </Box>
  );
}

export default function AddWorkOrderTabbedModal(props: PropsType) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const { logo, name: brandName } = useBrand();
  const { categories } = useSelector((state) => state.categories);
  const { locations, locationsMini } = useSelector((state) => state.locations);
  const { open, onClose, fields, validation, values, onSubmit, onChange } =
    props;
  const [activeTab, setActiveTab] = useState(0);
  const { companySettings } = useAuth();
  const timeZone =
    companySettings?.generalPreferences?.timeZone || ERIONE_TIME_ZONE;
  const [serverNow, setServerNow] = useState<Date | null>(null);

  // O "agora" e' capturado UMA vez por abertura: durante uma criacao ele nao
  // pode avancar de minuto em minuto. Fechar e reabrir o modal recalcula.
  useEffect(() => {
    if (!open) {
      setServerNow(null);
      return;
    }
    let cancelled = false;
    const hadClock = hasServerClock();
    // Com o relogio ja sincronizado por alguma resposta da API (o caso normal,
    // porque a propria listagem de OS ja passou por la), congela na hora:
    // abrir a OS nao pode esperar rede.
    if (hadClock) setServerNow(getServerNow());
    syncServerClock().then((now) => {
      // So' assume o valor vindo da rede quando nao havia relogio nenhum -
      // trocar o horario congelado depois que a tela ja apareceu seria
      // exatamente o pulo que essa UX evita.
      if (!cancelled && !hadClock) setServerNow(now);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const fieldByName = useMemo(
    () => new Map(fields.map((field) => [field.name, field])),
    [fields]
  );
  const initialAssignmentMode: AssignmentMode =
    fieldByName.has('team') &&
    (values?.team ||
      (!fieldByName.has('primaryUser') && !fieldByName.has('assignedTo')))
      ? 'TEAM'
      : 'COLLABORATORS';
  // Geral unmounts when Anexos is shown; keep the selected mode in the modal.
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(
    initialAssignmentMode
  );
  useEffect(() => {
    setAssignmentMode(initialAssignmentMode);
  }, [open, initialAssignmentMode]);
  const customFields = useMemo(
    () => fields.filter((field) => field.name.startsWith('customField_')),
    [fields]
  );
  const unsupportedRequiredFields = useMemo(
    () =>
      fields.filter(
        (field) => field.required && OMITTED_CREATE_FIELDS.has(field.name)
      ),
    [fields]
  );
  const initialFormValues = useMemo(() => {
    const primary = values?.primaryUser ? [values.primaryUser] : [];
    const additional = Array.isArray(values?.assignedTo)
      ? values.assignedTo
      : [];
    return {
      ...values,
      [UI_COLLABORATORS_FIELD]: [...primary, ...additional],
      [UI_TEAM_FIELD]: values?.team ?? null,
      // Hora vazia = automatica (horario do servidor). So' deixa de ser
      // automatica quando o usuario escolhe uma.
      [ESTIMATED_START_TIME_FIELD]: null
    };
  }, [values]);

  const effectiveValidation = useMemo(() => {
    if (!serverNow) return validation;
    return validation.shape({
      [ESTIMATED_START_TIME_FIELD]: Yup.mixed()
        .nullable()
        .test(
          'estimated-start-time-required',
          t('estimated_start_time_required'),
          function (value) {
            return !resolveEstimatedStart({
              date: parseApiDate(this.parent.estimatedStartDate),
              time: value,
              serverNow,
              timeZone
            }).error;
          }
        )
    });
  }, [validation, serverNow, timeZone, t]);

  const submitSanitizedValues = async (formValues: IHash<any>) => {
    const sanitizedValues = { ...formValues };
    delete sanitizedValues[UI_COLLABORATORS_FIELD];
    delete sanitizedValues[UI_TEAM_FIELD];
    // Data e hora so' vivem separadas na interface: o payload continua com um
    // unico `estimatedStartDate`, como o backend sempre recebeu.
    sanitizedValues.estimatedStartDate = resolveEstimatedStart({
      date: parseApiDate(formValues.estimatedStartDate),
      time: formValues[ESTIMATED_START_TIME_FIELD],
      serverNow: serverNow ?? getServerNow(),
      timeZone
    }).value;
    delete sanitizedValues[ESTIMATED_START_TIME_FIELD];
    await onSubmit(sanitizedValues);
  };

  const handleFinalSubmit = async (formik: FormikProps<IHash<any>>) => {
    const errors = await formik.validateForm();
    const errorFields = Object.keys(errors);
    if (errorFields.length) {
      formik.setTouched(
        errorFields.reduce(
          (touched, fieldName) => ({ ...touched, [fieldName]: true }),
          {}
        ),
        false
      );
      setActiveTab(
        errorFields.some((fieldName) => ATTACHMENT_FIELD_NAMES.has(fieldName))
          ? 1
          : 0
      );
      return;
    }
    await formik.submitForm();
  };

  const renderGeneral = (
    formik: FormikProps<IHash<any>>,
    handleChange: HandleFormChange
  ) => {
    const selectedCategoryId = Number(formik.values.category?.value);
    const defaultChecklist = categories['work-order-categories']?.find(
      (category) => category.id === selectedCategoryId
    )?.defaultChecklist;
    const categoryField = fieldByName.get('category');
    const descriptionField = fieldByName.get('description');
    const customerField = fieldByName.get('customers');
    const locationField = fieldByName.get('location');
    const selectedLocationId = Number(formik.values.location?.value);
    const selectedLocation = Number.isFinite(selectedLocationId)
      ? locations.find((location) => location.id === selectedLocationId) ??
        locationsMini.find((location) => location.id === selectedLocationId)
      : null;

    return (
      <Grid item xs={12} className="wo-create-scroll-content">
        <Box sx={{ maxWidth: 1480, mx: 'auto', width: '100%' }}>
          {unsupportedRequiredFields.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('wo_add_required_configuration_conflict', {
                fields: unsupportedRequiredFields
                  .map((field) => field.label)
                  .join(', ')
              })}
            </Alert>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'minmax(0, 1fr) minmax(0, 1.35fr)',
                xl: 'minmax(0, 1fr) minmax(0, 1.5fr)'
              },
              gap: { xs: 2, lg: 2.5 },
              alignItems: 'start'
            }}
          >
            <Stack spacing={2} className="wo-create-section">
              <Stack
                direction="row"
                alignItems="flex-start"
                spacing={1.5}
                className="wo-create-section-heading"
              >
                <PlaceRoundedIcon className="wo-create-section-icon" />
                <Box minWidth={0}>
                  <Typography
                    component="h3"
                    variant="h4"
                    sx={{
                      fontSize: { xs: 18, sm: 20 },
                      fontWeight: 800,
                      color: BRAND.primaryDark,
                      lineHeight: 1.3
                    }}
                  >
                    {t('wo_add_destination_title')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, lineHeight: 1.5 }}
                  >
                    {t('wo_add_destination_helper')}
                  </Typography>
                </Box>
              </Stack>
              <FieldControl
                field={
                  customerField
                    ? { ...customerField, helperText: undefined }
                    : undefined
                }
                formik={formik}
                handleChange={handleChange}
              />
              <FieldControl
                field={
                  locationField
                    ? { ...locationField, hideLocationDetailsLink: true }
                    : undefined
                }
                formik={formik}
                handleChange={handleChange}
              />
              {selectedLocation && (
                <LocationPreview location={selectedLocation} />
              )}
              <AssignmentFields
                formik={formik}
                handleChange={handleChange}
                mode={assignmentMode}
                onModeChange={setAssignmentMode}
                primaryUserField={fieldByName.get('primaryUser')}
                assignedToField={fieldByName.get('assignedTo')}
                teamField={fieldByName.get('team')}
              />
              <EstimatedStartDateField
                field={fieldByName.get('estimatedStartDate')}
                formik={formik}
                handleChange={handleChange}
                serverNow={serverNow}
                timeZone={timeZone}
              />
            </Stack>

            <Stack
              spacing={2}
              className="wo-create-section"
              sx={{ animationDelay: '40ms' }}
            >
              <Stack
                direction="row"
                alignItems="flex-start"
                spacing={1.5}
                className="wo-create-section-heading"
              >
                <BuildOutlinedIcon className="wo-create-section-icon" />
                <Box minWidth={0}>
                  <Typography
                    component="h3"
                    variant="h4"
                    sx={{
                      fontSize: { xs: 18, sm: 20 },
                      fontWeight: 800,
                      color: BRAND.primaryDark,
                      lineHeight: 1.3
                    }}
                  >
                    {t('wo_add_service_title')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, lineHeight: 1.5 }}
                  >
                    {t('wo_add_service_helper')}
                  </Typography>
                </Box>
              </Stack>
              <FieldControl
                field={fieldByName.get('title')}
                formik={formik}
                handleChange={handleChange}
              />
              <FieldControl
                field={
                  descriptionField
                    ? { ...descriptionField, rows: 4 }
                    : undefined
                }
                formik={formik}
                handleChange={handleChange}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'minmax(0, 1.4fr) minmax(0, 1fr)'
                  },
                  gap: 2
                }}
              >
                <FieldControl
                  field={
                    categoryField
                      ? {
                          ...categoryField,
                          hideCategoryChecklistAlert: true
                        }
                      : undefined
                  }
                  formik={formik}
                  handleChange={handleChange}
                />
                <FieldControl
                  field={fieldByName.get('priority')}
                  formik={formik}
                  handleChange={handleChange}
                />
              </Box>
              <Box
                role="status"
                aria-live="polite"
                aria-atomic="true"
                sx={{
                  p: 1.75,
                  borderRadius: 1.5,
                  backgroundColor: defaultChecklist
                    ? alpha(BRAND.primary, 0.065)
                    : alpha(BRAND.primaryDark, 0.025),
                  border: `1px solid ${alpha(
                    BRAND.primary,
                    defaultChecklist ? 0.14 : 0.07
                  )}`,
                  borderLeft: `3px solid ${
                    defaultChecklist
                      ? BRAND.primary
                      : alpha(BRAND.primary, 0.25)
                  }`
                }}
              >
                <Stack direction="row" alignItems="flex-start" spacing={1.25}>
                  <AssignmentOutlinedIcon
                    sx={{ fontSize: 22, color: BRAND.primary, mt: 0.25 }}
                  />
                  <Box minWidth={0} sx={{ flex: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      sx={{ flexWrap: 'wrap', gap: 1, mb: 0.75 }}
                    >
                      <Typography variant="subtitle2" fontWeight={700}>
                        {t('questionnaire')}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 0.9,
                          py: 0.2,
                          borderRadius: 0.75,
                          color: BRAND.primary,
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${alpha(BRAND.primary, 0.12)}`,
                          fontWeight: 700,
                          letterSpacing: 0.4
                        }}
                      >
                        {t('wo_add_automatic')}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {defaultChecklist?.name ||
                        t('wo_add_no_default_questionnaire')}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, lineHeight: 1.5 }}
                    >
                      {t(
                        defaultChecklist
                          ? 'wo_add_questionnaire_linked_helper'
                          : 'wo_add_questionnaire_empty_helper'
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
              {fieldByName.get('requiredSignature') && (
                <CustomSwitch
                  title={t('requires_signature')}
                  description=""
                  name="requiredSignature"
                  handleChange={formik.handleChange}
                  checked={Boolean(formik.values.requiredSignature)}
                  disableGridItem
                  sx={{
                    mb: 0,
                    p: 1,
                    borderRadius: 1.25,
                    backgroundColor: alpha(BRAND.primary, 0.035)
                  }}
                  titleSx={{ typography: 'body2', fontWeight: 600, mb: 0 }}
                />
              )}
            </Stack>
          </Box>

          {customFields.length > 0 && (
            <Box
              sx={{
                mt: 2.5,
                pt: 2.25,
                borderTop: `1px solid ${theme.palette.divider}`
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                {t('custom_fields')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: 'repeat(2, minmax(0, 1fr))'
                  },
                  gap: 2
                }}
              >
                {customFields.map((field) => (
                  <FieldControl
                    key={field.name}
                    field={field}
                    formik={formik}
                    handleChange={handleChange}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Grid>
    );
  };

  const renderAttachments = (
    formik: FormikProps<IHash<any>>,
    handleChange: HandleFormChange
  ) => (
    <Grid item xs={12} className="wo-create-scroll-content">
      <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%' }}>
        <Typography variant="h4" fontWeight={750}>
          {t('wo_add_tab_attachments')}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 2.5 }}
        >
          {t('wo_add_attachments_helper')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(2, minmax(0, 1fr))'
            },
            gap: 2.5
          }}
        >
          <FieldControl
            field={fieldByName.get('files')}
            formik={formik}
            handleChange={handleChange}
          />
          <FieldControl
            field={fieldByName.get('image')}
            formik={formik}
            handleChange={handleChange}
          />
        </Box>
      </Box>
    </Grid>
  );

  return (
    <Dialog
      maxWidth={false}
      aria-labelledby="wo-create-title"
      aria-describedby="wo-create-description"
      open={open}
      onClose={(_event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        onClose();
      }}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          width: { xs: 'calc(100vw - 16px)', sm: '92vw' },
          maxWidth: 1360,
          height: {
            xs: 'calc(100vh - 16px)',
            sm: 'min(840px, calc(100vh - 48px))'
          },
          maxHeight: { xs: 'calc(100vh - 16px)', sm: 'calc(100vh - 48px)' },
          '@supports (height: 100dvh)': {
            height: {
              xs: 'calc(100dvh - 16px)',
              sm: 'min(840px, calc(100dvh - 48px))'
            },
            maxHeight: { xs: 'calc(100dvh - 16px)', sm: 'calc(100dvh - 48px)' }
          },
          m: { xs: 1, sm: 2 },
          borderRadius: 2.5,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: BRAND.surface,
          backgroundImage: `radial-gradient(ellipse at top right, ${alpha(
            BRAND.primary,
            0.065
          )}, transparent 65%)`,
          boxShadow: `0 24px 72px ${alpha(theme.palette.common.black, 0.22)}`
        }
      }}
      BackdropProps={{
        sx: { backgroundColor: alpha('#102A3A', 0.42) }
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          flexShrink: 0,
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2.5 },
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          color: '#fff',
          backgroundColor: BRAND.primaryDark,
          backgroundImage: `radial-gradient(ellipse at top right, ${alpha(
            BRAND.primary,
            0.65
          )}, transparent 72%), linear-gradient(110deg, ${
            BRAND.primaryDarker
          }, ${BRAND.primaryDark})`,
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${BRAND.accent} 0px, ${
              BRAND.accent
            } 64px, ${alpha('#fff', 0.12)} 64px, ${alpha('#fff', 0.12)} 100%)`
          }
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={2}
          width="100%"
        >
          <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
            {(logo.dark || logo.white) && (
              <Box
                component="img"
                src={logo.dark || logo.white}
                alt={brandName}
                sx={{
                  width: { xs: 44, sm: 52 },
                  height: { xs: 44, sm: 52 },
                  p: 0.75,
                  borderRadius: 1.5,
                  backgroundColor: '#fff',
                  objectFit: 'contain',
                  flexShrink: 0
                }}
              />
            )}
            <Box minWidth={0}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: alpha('#fff', 0.7),
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.6,
                  mb: 0.5
                }}
              >
                {brandName}
              </Typography>
              <Typography
                component="h2"
                variant="h4"
                fontWeight={800}
                sx={{
                  fontSize: { xs: 20, sm: 26 },
                  lineHeight: 1.25,
                  overflowWrap: 'anywhere',
                  color: '#fff',
                  letterSpacing: -0.5
                }}
              >
                {t('add_wo')}
              </Typography>
              <Typography
                id="wo-create-description"
                variant="body2"
                sx={{ mt: 0.5, lineHeight: 1.5, color: alpha('#fff', 0.75) }}
              >
                {t('wo_add_subtitle')}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label={t('close')}
            onClick={onClose}
            size="small"
            sx={{
              flexShrink: 0,
              color: '#fff',
              backgroundColor: alpha('#fff', 0.08),
              border: `1px solid ${alpha('#fff', 0.12)}`,
              '&:hover': { backgroundColor: alpha('#fff', 0.16) }
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_event, value) => setActiveTab(value)}
        aria-label={t('wo_add_tabs_label')}
        TabIndicatorProps={{ sx: { display: 'none !important' } }}
        sx={{
          minHeight: 52,
          flexShrink: 0,
          px: { xs: 1.5, sm: 3 },
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '& .MuiTab-root': {
            minHeight: 52,
            px: 2.25,
            textTransform: 'none',
            fontSize: 14,
            fontWeight: 700,
            backgroundColor: 'transparent',
            color: theme.palette.text.secondary,
            zIndex: 1,
            '&.Mui-selected, &.Mui-selected:hover': {
              backgroundColor: 'transparent',
              color: `${BRAND.primary} !important`,
              borderBottom: `3px solid ${BRAND.primary}`
            }
          },
          '& .MuiTabs-indicator': { display: 'none !important' }
        }}
      >
        <Tab
          disableRipple
          label={t('wo_add_tab_general')}
          sx={{
            background: 'transparent !important',
            boxShadow: 'none !important'
          }}
        />
        <Tab
          disableRipple
          label={t('wo_add_tab_attachments')}
          sx={{
            background: 'transparent !important',
            boxShadow: 'none !important'
          }}
        />
      </Tabs>

      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          '& > .MuiBox-root': {
            display: 'flex',
            flex: 1,
            minWidth: 0,
            minHeight: 0
          },
          '& > .MuiBox-root > .MuiGrid-container': {
            m: 0,
            width: '100%',
            minHeight: 0,
            flex: 1,
            flexDirection: 'column',
            flexWrap: 'nowrap'
          },
          '& .wo-create-scroll-content': {
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            p: { xs: 1.5, sm: 2, lg: 2.5 }
          },
          '& .wo-create-section': {
            minWidth: 0,
            p: { xs: 2, lg: 2.5 },
            borderRadius: 2,
            border: `1px solid ${alpha(BRAND.primary, 0.09)}`,
            backgroundColor: theme.palette.background.paper,
            boxShadow: `0 4px 16px ${alpha(BRAND.primaryDark, 0.035)}`,
            animation: 'wo-create-reveal 220ms ease-out both'
          },
          '& .wo-create-section-heading': {
            pb: 1.75,
            borderBottom: `1px solid ${alpha(BRAND.primary, 0.08)}`
          },
          '& .wo-create-section-icon': {
            boxSizing: 'content-box',
            fontSize: 22,
            flexShrink: 0,
            p: 1,
            borderRadius: 1.25,
            color: BRAND.primary,
            backgroundColor: alpha(BRAND.primary, 0.07)
          },
          '@keyframes wo-create-reveal': {
            from: { opacity: 0, transform: 'translateY(5px)' },
            to: { opacity: 1, transform: 'translateY(0)' }
          },
          '@media (prefers-reduced-motion: reduce)': {
            '& .wo-create-section': { animation: 'none' }
          },
          '& > .MuiBox-root > .MuiGrid-container > .MuiGrid-item:last-of-type':
            {
              flex: '0 0 auto',
              px: { xs: 2, sm: 3 },
              py: 1.5,
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              boxShadow: `0 -6px 18px ${alpha(
                theme.palette.common.black,
                0.04
              )}`
            },
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            backgroundColor: theme.palette.background.paper,
            '& fieldset': {
              borderColor: alpha(BRAND.primaryDark, 0.18)
            },
            '&:hover fieldset': {
              borderColor: alpha(BRAND.primary, 0.45)
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(BRAND.primary, 0.09)}`,
              '& fieldset': { borderColor: BRAND.primary }
            }
          },
          '& .MuiInputBase-root:not(.MuiInputBase-multiline)': {
            minHeight: 50
          },
          '& .MuiInputLabel-root': { fontSize: 14, fontWeight: 600 },
          '& .MuiInputLabel-root.Mui-focused': { color: BRAND.primary },
          '& .MuiRadio-root.Mui-checked': { color: BRAND.primary },
          '& .MuiSwitch-switchBase.Mui-checked': { color: BRAND.primary },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
            backgroundColor: `${BRAND.primary} !important`
          },
          '& .MuiButton-textPrimary': { color: BRAND.primary }
        }}
      >
        <Box>
          <Form
            fields={fields}
            validation={effectiveValidation}
            values={initialFormValues}
            onChange={onChange}
            onSubmit={submitSanitizedValues}
            renderContent={(formik, handleChange) =>
              activeTab === 0
                ? renderGeneral(formik, handleChange)
                : renderAttachments(formik, handleChange)
            }
            renderActions={(formik) => (
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                width="100%"
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    maxWidth: 430,
                    lineHeight: 1.5
                  }}
                >
                  {t('wo_add_review_helper')}
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    ml: 'auto !important',
                    width: { xs: '100%', md: 'auto' },
                    justifyContent: 'space-between'
                  }}
                >
                  <Button
                    sx={{ color: BRAND.primary, fontWeight: 700, px: 2 }}
                    onClick={onClose}
                    disabled={formik.isSubmitting}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => handleFinalSubmit(formik)}
                    startIcon={
                      formik.isSubmitting ? (
                        <CircularProgress size="1rem" />
                      ) : null
                    }
                    disabled={
                      Boolean(formik.errors.submit) || formik.isSubmitting
                    }
                    endIcon={
                      !formik.isSubmitting ? (
                        <ArrowForwardRoundedIcon />
                      ) : undefined
                    }
                    sx={{
                      minWidth: 126,
                      borderRadius: 1.5,
                      px: 3,
                      py: 1.05,
                      fontWeight: 750,
                      backgroundColor: BRAND.primary,
                      boxShadow: `0 4px 10px ${alpha(BRAND.primary, 0.2)}`,
                      '&:hover': {
                        backgroundColor: darken(BRAND.primary, 0.12)
                      }
                    }}
                  >
                    {t('create_work_order')}
                  </Button>
                </Stack>
              </Stack>
            )}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
