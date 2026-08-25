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
import DateTimePicker from '@mui/lab/DateTimePicker';
import { FormikProps } from 'formik';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { parseApiDate } from '../../../../utils/dateTime';
import { LocationMiniDTO } from '../../../../models/owns/location';
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
      onChange={(event) =>
        handleChange(formik, field.name, event.target.value)
      }
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
  primaryUserField,
  assignedToField,
  teamField
}: {
  formik: FormikProps<IHash<any>>;
  handleChange: HandleFormChange;
  primaryUserField?: IField;
  assignedToField?: IField;
  teamField?: IField;
}) {
  const { t }: { t: any } = useTranslation();
  const collaboratorsAvailable = Boolean(primaryUserField || assignedToField);
  const teamAvailable = Boolean(teamField);
  const [mode, setMode] = useState<AssignmentMode>(
    !collaboratorsAvailable && teamAvailable ? 'TEAM' : 'COLLABORATORS'
  );

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
    setMode(nextMode);
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
          sx={{ mb: 0.75, gap: 1 }}
        >
          <FormControlLabel
            value="COLLABORATORS"
            control={<Radio size="small" />}
            label={t('wo_add_collaborator_mode')}
            sx={{ mr: 1.5 }}
          />
          <FormControlLabel
            value="TEAM"
            control={<Radio size="small" />}
            label={t('team')}
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

function LocationPreview({ location }: { location: LocationMiniDTO }) {
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
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: hasCoordinates ? 1 : 0 }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={0.75} minWidth={0}>
          <PlaceRoundedIcon
            sx={{ mt: 0.15, fontSize: 18, color: BRAND.primary, flexShrink: 0 }}
          />
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {location.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {location.address || t('wo_add_destination_no_address')}
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
  const { locationsMini } = useSelector((state) => state.locations);
  const { open, onClose, fields, validation, values, onSubmit, onChange } =
    props;
  const [activeTab, setActiveTab] = useState(0);

  const fieldByName = useMemo(
    () => new Map(fields.map((field) => [field.name, field])),
    [fields]
  );
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
      [UI_TEAM_FIELD]: values?.team ?? null
    };
  }, [values]);

  const submitSanitizedValues = async (formValues: IHash<any>) => {
    const sanitizedValues = { ...formValues };
    delete sanitizedValues[UI_COLLABORATORS_FIELD];
    delete sanitizedValues[UI_TEAM_FIELD];
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
      ? locationsMini.find((location) => location.id === selectedLocationId)
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
                md: 'minmax(300px, 38%) minmax(0, 62%)',
                xl: 'minmax(320px, 34%) minmax(0, 66%)'
              },
              columnGap: 3,
              rowGap: 2.5
            }}
          >
            <Stack
              spacing={2.25}
              sx={{
                minWidth: 0,
                pr: { md: 3 },
                borderRight: {
                  xs: 0,
                  md: `1px solid ${theme.palette.divider}`
                }
              }}
            >
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
              {selectedLocation && <LocationPreview location={selectedLocation} />}
              <AssignmentFields
                formik={formik}
                handleChange={handleChange}
                primaryUserField={fieldByName.get('primaryUser')}
                assignedToField={fieldByName.get('assignedTo')}
                teamField={fieldByName.get('team')}
              />
              <FieldControl
                field={fieldByName.get('estimatedStartDate')}
                formik={formik}
                handleChange={handleChange}
              />
            </Stack>

            <Stack spacing={2.25} sx={{ minWidth: 0 }}>
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
                    sm: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(150px, .75fr)'
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
                <TextField
                  fullWidth
                  label={t('questionnaire')}
                  value={
                    defaultChecklist?.name || t('wo_add_no_default_questionnaire')
                  }
                  InputProps={{ readOnly: true }}
                  inputProps={{ 'aria-label': t('questionnaire') }}
                  sx={{
                    '& .MuiInputBase-root': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.025)
                    }
                  }}
                />
                <FieldControl
                  field={fieldByName.get('priority')}
                  formik={formik}
                  handleChange={handleChange}
                />
              </Box>
              {fieldByName.get('requiredSignature') && (
                <CustomSwitch
                  title={t('requires_signature')}
                  description=""
                  name="requiredSignature"
                  handleChange={formik.handleChange}
                  checked={Boolean(formik.values.requiredSignature)}
                  disableGridItem
                  sx={{ mb: 0 }}
                  titleSx={{ typography: 'body2', fontWeight: 600, mb: 0 }}
                />
              )}
              <FieldControl
                field={
                  fieldByName.get('asset')
                    ? {
                        ...fieldByName.get('asset'),
                        label: t('wo_add_equipment_label'),
                        placeholder: t('wo_add_equipment_placeholder')
                      }
                    : undefined
                }
                formik={formik}
                handleChange={handleChange}
              />
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
      open={open}
      onClose={(_event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        onClose();
      }}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          width: { xs: 'calc(100vw - 16px)', sm: '92vw' },
          maxWidth: 1480,
          maxHeight: '88vh',
          m: { xs: 1, sm: 2 },
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#F7F9FC',
          boxShadow: `0 24px 72px ${alpha(
            theme.palette.common.black,
            0.22
          )}`
        }
      }}
      BackdropProps={{
        sx: { backgroundColor: alpha('#102A3A', 0.42) }
      }}
    >
      <DialogTitle
        sx={{
          minHeight: 72,
          px: { xs: 2, sm: 3 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
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
                  width: 38,
                  height: 38,
                  objectFit: 'contain',
                  flexShrink: 0
                }}
              />
            )}
            <Box minWidth={0}>
              <Typography variant="h4" fontWeight={800} noWrap>
                {t('add_wo')}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {t('wo_add_subtitle')}
              </Typography>
            </Box>
          </Stack>
          <IconButton aria-label={t('close')} onClick={onClose} size="small">
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
          minHeight: 46,
          px: { xs: 1.5, sm: 3 },
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '& .MuiTab-root': {
            minHeight: 46,
            px: 2.25,
            textTransform: 'none',
            fontSize: 14,
            fontWeight: 700,
            backgroundColor: 'transparent',
            color: theme.palette.text.secondary,
            zIndex: 1,
            '&.Mui-selected': {
              backgroundColor: 'transparent',
              color: BRAND.primary,
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
          minHeight: 0,
          overflow: 'hidden',
          '& > .MuiBox-root': { height: '100%' },
          '& > .MuiBox-root > .MuiGrid-container': {
            m: 0,
            width: '100%',
            maxHeight: 'calc(88vh - 118px)',
            flexDirection: 'column',
            flexWrap: 'nowrap'
          },
          '& .wo-create-scroll-content': {
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            p: { xs: 2, sm: 3 }
          },
          '& > .MuiBox-root > .MuiGrid-container > .MuiGrid-item:last-of-type': {
            flex: '0 0 auto',
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            boxShadow: `0 -6px 18px ${alpha(
              theme.palette.common.black,
              0.04
            )}`
          },
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.25,
            backgroundColor: theme.palette.background.paper,
            '& fieldset': {
              borderColor: alpha(theme.palette.text.primary, 0.18)
            },
            '&:hover fieldset': {
              borderColor: alpha(BRAND.primary, 0.45)
            },
            '&.Mui-focused fieldset': { borderColor: BRAND.primary }
          },
          '& .MuiInputBase-root:not(.MuiInputBase-multiline)': {
            minHeight: 50
          },
          '& .MuiInputLabel-root': { fontSize: 14, fontWeight: 600 }
        }}
      >
        <Box>
          <Form
            fields={fields}
            validation={validation}
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
                width="100%"
              >
                <Button
                  color="secondary"
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
                  sx={{
                    minWidth: 126,
                    borderRadius: 1.25,
                    px: 3,
                    py: 1.05,
                    fontWeight: 750,
                    backgroundColor: BRAND.primary,
                    '&:hover': {
                      backgroundColor: darken(BRAND.primary, 0.12)
                    }
                  }}
                >
                  {t('create_work_order')}
                </Button>
              </Stack>
            )}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
