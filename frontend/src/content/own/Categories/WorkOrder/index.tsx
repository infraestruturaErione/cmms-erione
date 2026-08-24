import {
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import ArticleTwoToneIcon from '@mui/icons-material/ArticleTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import ContentCopyTwoToneIcon from '@mui/icons-material/ContentCopyTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import DirectionsCarTwoToneIcon from '@mui/icons-material/DirectionsCarTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import FactCheckTwoToneIcon from '@mui/icons-material/FactCheckTwoTone';
import PhotoCameraTwoToneIcon from '@mui/icons-material/PhotoCameraTwoTone';
import PlaylistAddCheckTwoToneIcon from '@mui/icons-material/PlaylistAddCheckTwoTone';
import SearchTwoToneIcon from '@mui/icons-material/SearchTwoTone';
import MoreHorizTwoToneIcon from '@mui/icons-material/MoreHorizTwoTone';
import { TitleContext } from '../../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../../store';
import {
  addCategory,
  deleteCategory,
  editCategory,
  getCategories
} from '../../../../slices/category';
import { getChecklists } from '../../../../slices/checklist';
import Category from '../../../../models/owns/category';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import { PlanFeature } from '../../../../models/owns/subscriptionPlan';
import { getErrorMessage } from '../../../../utils/api';
import PermissionErrorMessage from '../../components/PermissionErrorMessage';
import FeatureErrorMessage from '../../components/FeatureErrorMessage';
import ConfirmDialog from '../../components/ConfirmDialog';
import SelectForm from '../../components/form/SelectForm';
import WorkOrderConfigurationHeader from '../WorkOrderConfigurationHeader';

const BASE_PATH = 'work-order-categories';

interface WorkOrderTypeValues {
  name: string;
  description: string;
  toleranceMinutes: string | number;
  defaultEstimatedDuration: string | number;
  checklistId: number | null;
  requirePhotos: boolean;
  requireFieldReport: boolean;
  requireMileage: boolean;
  requireChecklistCompletion: boolean;
  // Preservados no payload para uma edição visual não alterar regras legadas.
  requireSignature: boolean;
  requireSignerName: boolean;
  requireSignerDocument: boolean;
}

const initialValues = (category?: Category): WorkOrderTypeValues => ({
  name: category?.name ?? '',
  description: category?.description ?? '',
  toleranceMinutes: category?.toleranceMinutes ?? '',
  defaultEstimatedDuration: category?.defaultEstimatedDuration ?? '',
  checklistId: category?.defaultChecklist?.id ?? null,
  requirePhotos: category?.requirePhotos ?? false,
  requireFieldReport: category?.requireFieldReport ?? false,
  requireMileage: category?.requireMileage ?? false,
  requireChecklistCompletion: category?.requireChecklistCompletion ?? false,
  requireSignature: category?.requireSignature ?? false,
  requireSignerName: category?.requireSignerName ?? false,
  requireSignerDocument: category?.requireSignerDocument ?? false
});

const toPayload = (values: WorkOrderTypeValues, companySettingsId: number) => ({
  name: values.name.trim(),
  description: values.description?.trim() ?? '',
  companySettings: { id: companySettingsId },
  toleranceMinutes:
    values.toleranceMinutes === '' ? null : Number(values.toleranceMinutes),
  defaultEstimatedDuration:
    values.defaultEstimatedDuration === ''
      ? null
      : Number(values.defaultEstimatedDuration),
  defaultChecklist: values.checklistId ? { id: values.checklistId } : null,
  requirePhotos: values.requirePhotos,
  requireFieldReport: values.requireFieldReport,
  requireMileage: values.requireMileage,
  requireChecklistCompletion:
    !!values.checklistId && values.requireChecklistCompletion,
  requireSignature: values.requireSignature,
  requireSignerName: values.requireSignerName,
  requireSignerDocument: values.requireSignerDocument
});

const SectionCard = ({
  icon,
  title,
  helper,
  children
}: {
  icon: ReactNode;
  title: string;
  helper?: string;
  children: ReactNode;
}) => (
  <Card
    variant="outlined"
    sx={{
      p: { xs: 2, sm: 2.5 },
      borderRadius: 2.5,
      boxShadow: (theme) =>
        `0 10px 28px ${alpha(theme.palette.common.black, 0.03)}`
    }}
  >
    <Box
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2.25 }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          borderRadius: 1.5,
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09)
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h5">{title}</Typography>
        {helper && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {helper}
          </Typography>
        )}
      </Box>
    </Box>
    {children}
  </Card>
);

const RequirementOption = ({
  icon,
  title,
  helper,
  checked,
  disabled,
  readOnly,
  badge,
  onChange
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  checked: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  badge?: string;
  onChange?: (checked: boolean) => void;
}) => (
  <Box
    sx={{
      display: 'flex',
      gap: 1.25,
      alignItems: 'flex-start',
      p: 1.75,
      height: '100%',
      borderRadius: 1.5,
      border: (theme) => `1px solid ${theme.colors.alpha.black[10]}`,
      bgcolor: checked
        ? (theme) => alpha(theme.palette.primary.main, 0.035)
        : 'transparent',
      opacity: disabled ? 0.55 : 1
    }}
  >
    <Box sx={{ color: checked ? 'primary.main' : 'text.secondary', mt: 0.25 }}>
      {icon}
    </Box>
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {readOnly ? (
          <Chip size="small" label={badge} sx={{ height: 22 }} />
        ) : (
          <Switch
            size="small"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.checked)}
          />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {helper}
      </Typography>
    </Box>
  </Box>
);

export default function WorkOrderCategories() {
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { setTitle } = useContext(TitleContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { categories, loading } = useSelector((state) => state.categories);
  const { checklists } = useSelector((state) => state.checklists);
  const {
    user,
    hasViewPermission,
    hasCreatePermission,
    hasEditPermission,
    hasDeletePermission,
    hasFeature,
    companySettings
  } = useAuth();
  const [search, setSearch] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [otherCategoriesAnchor, setOtherCategoriesAnchor] =
    useState<HTMLElement | null>(null);
  const questionnaireSelectRef = useRef<HTMLDivElement | null>(null);
  const items = categories[BASE_PATH] ?? [];
  const canCreate = hasCreatePermission(PermissionEntity.CATEGORIES);
  const photosRequiredGlobally =
    companySettings?.workOrderConfiguration.workOrderFieldConfigurations.some(
      (field) =>
        field.fieldName === 'completeFiles' && field.fieldType === 'REQUIRED'
    ) ?? false;

  useEffect(() => {
    setTitle(t('wo_types_configuration'));
    if (hasViewPermission(PermissionEntity.CATEGORIES_WEB)) {
      dispatch(getCategories(BASE_PATH));
      dispatch(getChecklists());
    }
  }, []);

  const filteredItems = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return items;
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(value) ||
        item.description?.toLowerCase().includes(value) ||
        item.defaultChecklist?.name?.toLowerCase().includes(value)
    );
  }, [items, search]);

  const closeEditor = () => {
    setCreating(false);
    setEditingCategory(null);
  };

  const openQuestionnaireSelector = () => {
    const input = questionnaireSelectRef.current?.querySelector('input');
    input?.focus();
    questionnaireSelectRef.current
      ?.querySelector<HTMLButtonElement>('.MuiAutocomplete-popupIndicator')
      ?.click();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteCategory(deleteTarget.id, BASE_PATH));
      showSnackBar(t('category_delete_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDuplicate = async (category: Category) => {
    setDuplicatingId(category.id);
    try {
      await dispatch(
        addCategory(
          toPayload(
            {
              ...initialValues(category),
              name: t('work_order_type_copy_name', { name: category.name })
            },
            user.companySettingsId
          ),
          BASE_PATH
        )
      );
      showSnackBar(t('work_order_type_duplicate_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setDuplicatingId(null);
    }
  };

  if (!hasViewPermission(PermissionEntity.CATEGORIES_WEB)) {
    return <PermissionErrorMessage message="no_access_categories" />;
  }

  if (creating || editingCategory) {
    const category = editingCategory ?? undefined;
    return (
      <Box
        p={{ xs: 2, md: 4 }}
        sx={{ maxWidth: 1500, mx: 'auto', width: '100%' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={closeEditor} aria-label={t('cancel')}>
            <ArrowBackTwoToneIcon />
          </IconButton>
          <Box>
            <Typography variant="h3">
              {category ? t('edit_work_order_type') : t('new_work_order_type')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.25 }}
            >
              {t('work_order_type_form_helper')}
            </Typography>
          </Box>
        </Box>

        <Formik
          enableReinitialize
          initialValues={initialValues(category)}
          validationSchema={Yup.object().shape({
            name: Yup.string().max(30).required(t('required_name'))
          })}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              const payload = toPayload(values, user.companySettingsId);
              if (category)
                await dispatch(editCategory(category.id, payload, BASE_PATH));
              else await dispatch(addCategory(payload, BASE_PATH));
              showSnackBar(
                category
                  ? t('changes_saved_success')
                  : t('category_create_success'),
                'success'
              );
              closeEditor();
            } catch (error) {
              showSnackBar(getErrorMessage(error), 'error');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({
            errors,
            handleBlur,
            handleChange,
            handleSubmit,
            isSubmitting,
            setFieldValue,
            touched,
            values
          }) => {
            const selectedChecklist = checklists.find(
              (checklist) => checklist.id === values.checklistId
            );
            return (
              <form onSubmit={handleSubmit}>
                <Grid container spacing={3} alignItems="flex-start">
                  <Grid item xs={12} lg={9}>
                    <Stack spacing={2.5}>
                      <SectionCard
                        icon={<FactCheckTwoToneIcon />}
                        title={t('category_section_basic_info')}
                      >
                        <Stack spacing={2}>
                          <TextField
                            fullWidth
                            name="name"
                            label={t('work_order_type_name')}
                            value={values.name}
                            onBlur={handleBlur}
                            onChange={handleChange}
                            error={Boolean(touched.name && errors.name)}
                            helperText={touched.name && errors.name}
                          />
                          <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            name="description"
                            label={t('description')}
                            value={values.description}
                            onChange={handleChange}
                          />
                        </Stack>
                      </SectionCard>

                      <SectionCard
                        icon={<AssignmentTwoToneIcon />}
                        title={t('linked_questionnaire')}
                        helper={t('task_type_checklist_section_helper')}
                      >
                        {!hasFeature(PlanFeature.CHECKLIST) ? (
                          <FeatureErrorMessage message="upgrade_checklist" />
                        ) : (
                          <Stack spacing={1.75}>
                            <Box ref={questionnaireSelectRef}>
                              <SelectForm
                                options={
                                  checklists.map((checklist) => ({
                                    label: t('checklist_option_label', {
                                      name: checklist.name,
                                      count: checklist.taskBases?.length ?? 0
                                    }),
                                    value: checklist.id
                                  })) as any
                                }
                                value={
                                  (selectedChecklist
                                    ? {
                                        label: t('checklist_option_label', {
                                          name: selectedChecklist.name,
                                          count:
                                            selectedChecklist.taskBases
                                              ?.length ?? 0
                                        }),
                                        value: selectedChecklist.id
                                      }
                                    : null) as any
                                }
                                label="questionnaire"
                                placeholder={t(
                                  'search_questionnaire_placeholder'
                                )}
                                onChange={(_event: any, option: any) => {
                                  const checklistId = option
                                    ? Number(option.value)
                                    : null;
                                  setFieldValue('checklistId', checklistId);
                                  if (!checklistId)
                                    setFieldValue(
                                      'requireChecklistCompletion',
                                      false
                                    );
                                }}
                                disabled={false}
                                error={false}
                                errorMessage={undefined}
                                fullWidth
                              />
                            </Box>

                            {selectedChecklist ? (
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: { xs: 'flex-start', sm: 'center' },
                                  justifyContent: 'space-between',
                                  flexDirection: { xs: 'column', sm: 'row' },
                                  gap: 1.5,
                                  p: 1.75,
                                  borderRadius: 1.5,
                                  bgcolor: (theme) =>
                                    alpha(theme.palette.primary.main, 0.035),
                                  border: (theme) =>
                                    `1px solid ${alpha(
                                      theme.palette.primary.main,
                                      0.12
                                    )}`
                                }}
                              >
                                <Box>
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    {selectedChecklist.name}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.25 }}
                                  >
                                    {t('questions_count_value', {
                                      count:
                                        selectedChecklist.taskBases?.length ?? 0
                                    })}
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 0.75
                                  }}
                                >
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EditTwoToneIcon />}
                                    onClick={() =>
                                      window.open(
                                        `/app/checklists/${selectedChecklist.id}`,
                                        '_blank'
                                      )
                                    }
                                  >
                                    {t('open_questionnaire')}
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={openQuestionnaireSelector}
                                  >
                                    {t('change_questionnaire')}
                                  </Button>
                                  <Button
                                    size="small"
                                    color="secondary"
                                    onClick={() => {
                                      setFieldValue('checklistId', null);
                                      setFieldValue(
                                        'requireChecklistCompletion',
                                        false
                                      );
                                    }}
                                  >
                                    {t('clear_link')}
                                  </Button>
                                </Box>
                              </Box>
                            ) : (
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: { xs: 'flex-start', sm: 'center' },
                                  justifyContent: 'space-between',
                                  flexDirection: { xs: 'column', sm: 'row' },
                                  gap: 2,
                                  p: 2,
                                  borderRadius: 1.5,
                                  border: (theme) =>
                                    `1px dashed ${alpha(
                                      theme.palette.primary.main,
                                      0.2
                                    )}`,
                                  bgcolor: (theme) =>
                                    alpha(theme.palette.primary.main, 0.018)
                                }}
                              >
                                <Box>
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    {t('linked_questionnaire_empty_title')}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.35 }}
                                  >
                                    {t('linked_questionnaire_empty_helper')}
                                  </Typography>
                                </Box>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 0.75
                                  }}
                                >
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={openQuestionnaireSelector}
                                  >
                                    {t('select_questionnaire')}
                                  </Button>
                                  <Button
                                    size="small"
                                    startIcon={<AddTwoToneIcon />}
                                    onClick={() =>
                                      window.open(
                                        '/app/checklists/new',
                                        '_blank'
                                      )
                                    }
                                  >
                                    {t('create_new_checklist')}
                                  </Button>
                                </Box>
                              </Box>
                            )}
                          </Stack>
                        )}
                      </SectionCard>

                      <SectionCard
                        icon={<PlaylistAddCheckTwoToneIcon />}
                        title={t('task_type_requirements_section')}
                        helper={t('work_order_type_requirements_helper')}
                      >
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} md={6}>
                            <RequirementOption
                              icon={<ArticleTwoToneIcon fontSize="small" />}
                              title={t('field_report_always_required_label')}
                              helper={t('field_report_always_required_helper')}
                              checked
                              readOnly
                              badge={t('always_required_badge')}
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <RequirementOption
                              icon={<PhotoCameraTwoToneIcon fontSize="small" />}
                              title={t('task_type_require_photos')}
                              helper={t(
                                photosRequiredGlobally
                                  ? 'photo_required_by_global_configuration'
                                  : 'category_require_photos_helper'
                              )}
                              checked={
                                photosRequiredGlobally || values.requirePhotos
                              }
                              readOnly={photosRequiredGlobally}
                              badge={t('global_configuration_badge')}
                              onChange={(checked) =>
                                setFieldValue('requirePhotos', checked)
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <RequirementOption
                              icon={<FactCheckTwoToneIcon fontSize="small" />}
                              title={t(
                                'task_type_require_checklist_completion'
                              )}
                              helper={
                                values.checklistId
                                  ? t(
                                      'category_require_checklist_completion_helper'
                                    )
                                  : t('checklist_completion_disabled_helper')
                              }
                              checked={
                                !!values.checklistId &&
                                values.requireChecklistCompletion
                              }
                              disabled={!values.checklistId}
                              onChange={(checked) =>
                                setFieldValue(
                                  'requireChecklistCompletion',
                                  checked
                                )
                              }
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <RequirementOption
                              icon={
                                <DirectionsCarTwoToneIcon fontSize="small" />
                              }
                              title={t('task_type_require_mileage')}
                              helper={t('category_require_mileage_helper')}
                              checked={values.requireMileage}
                              onChange={(checked) =>
                                setFieldValue('requireMileage', checked)
                              }
                            />
                          </Grid>
                        </Grid>
                      </SectionCard>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} lg={3}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 2.5,
                        borderRadius: 2.5,
                        position: { lg: 'sticky' },
                        top: 24,
                        boxShadow: (theme) =>
                          `0 10px 28px ${alpha(
                            theme.palette.common.black,
                            0.03
                          )}`
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <AssignmentTwoToneIcon color="primary" />
                        <Typography variant="h5">
                          {t('field_execution_impact')}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                      >
                        {t('field_execution_impact_helper')}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Stack spacing={1.5}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <CheckCircleTwoToneIcon
                            color="success"
                            sx={{ fontSize: 19, mt: 0.05 }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t('field_report_always_required_label')}
                          </Typography>
                        </Box>
                        {(values.requirePhotos || photosRequiredGlobally) && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <CheckCircleTwoToneIcon
                              color="success"
                              sx={{ fontSize: 19, mt: 0.05 }}
                            />
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {t('photographic_evidence')}
                              </Typography>
                              {photosRequiredGlobally && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {t('photo_required_by_global_configuration')}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        )}
                        {values.requireChecklistCompletion &&
                          values.checklistId && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <CheckCircleTwoToneIcon
                                color="success"
                                sx={{ fontSize: 19, mt: 0.05 }}
                              />
                              <Box>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {t('task_type_require_checklist_completion')}
                                </Typography>
                                {selectedChecklist && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {t('questions_count_value', {
                                      count:
                                        selectedChecklist.taskBases?.length ?? 0
                                    })}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          )}
                        {values.requireMileage && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <CheckCircleTwoToneIcon
                              color="success"
                              sx={{ fontSize: 19, mt: 0.05 }}
                            />
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600 }}
                            >
                              {t('task_type_require_mileage')}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                      {selectedChecklist && (
                        <Box
                          sx={{
                            mt: 2,
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: 'background.default'
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {t('linked_questionnaire')}
                          </Typography>
                          <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
                            {selectedChecklist.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('questions_count_value', {
                              count: selectedChecklist.taskBases?.length ?? 0
                            })}
                          </Typography>
                        </Box>
                      )}
                    </Card>
                  </Grid>
                </Grid>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1.5,
                    mt: 3,
                    pt: 2.5,
                    borderTop: (theme) =>
                      `1px solid ${theme.colors.alpha.black[10]}`
                  }}
                >
                  <Button color="secondary" onClick={closeEditor}>
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={isSubmitting}
                    startIcon={
                      isSubmitting ? <CircularProgress size="1rem" /> : null
                    }
                  >
                    {t('save')}
                  </Button>
                </Box>
              </form>
            );
          }}
        </Formik>
      </Box>
    );
  }

  return (
    <Box p={{ xs: 2, md: 4 }}>
      <WorkOrderConfigurationHeader
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<MoreHorizTwoToneIcon />}
              onClick={(event) => setOtherCategoriesAnchor(event.currentTarget)}
            >
              {t('other_categories')}
            </Button>
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<AddTwoToneIcon />}
                onClick={() => setCreating(true)}
              >
                {t('new_work_order_type')}
              </Button>
            )}
          </Stack>
        }
      />
      <Menu
        anchorEl={otherCategoriesAnchor}
        open={!!otherCategoriesAnchor}
        onClose={() => setOtherCategoriesAnchor(null)}
      >
        <MenuItem onClick={() => navigate('/app/categories/asset')}>
          {t('assets')}
        </MenuItem>
        <MenuItem onClick={() => navigate('/app/categories/time')}>
          {t('timers')}
        </MenuItem>
        <MenuItem onClick={() => navigate('/app/categories/cost')}>
          {t('costs')}
        </MenuItem>
      </Menu>

      <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box
          sx={{
            p: 2.5,
            borderBottom: (theme) => `1px solid ${theme.colors.alpha.black[10]}`
          }}
        >
          <TextField
            fullWidth
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search_work_order_type')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchTwoToneIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ maxWidth: 440 }}
          />
        </Box>

        {loading[BASE_PATH] ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : filteredItems.length ? (
          <Stack divider={<Divider flexItem />}>
            {filteredItems.map((item) => {
              const canEdit = hasEditPermission(
                PermissionEntity.CATEGORIES,
                item
              );
              const canDelete = hasDeletePermission(
                PermissionEntity.CATEGORIES,
                item
              );
              return (
                <Box
                  key={item.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      lg: 'minmax(260px, 1.2fr) minmax(220px, .8fr) minmax(280px, 1fr) auto'
                    },
                    gap: 2,
                    alignItems: 'center',
                    p: 2.5,
                    transition: 'background-color .2s ease',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ mb: 0.4 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {item.description || t('without_description')}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('linked_questionnaire')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {item.defaultChecklist?.name ||
                        t('without_questionnaire')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    <Chip size="small" label={t('field_report_short')} />
                    {item.requirePhotos && (
                      <Chip size="small" label={t('photos')} />
                    )}
                    {item.requireChecklistCompletion && (
                      <Chip
                        size="small"
                        label={t('questionnaire_required_short')}
                      />
                    )}
                    {item.requireMileage && (
                      <Chip size="small" label={t('mileage_short')} />
                    )}
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: { xs: 'flex-start', lg: 'flex-end' }
                    }}
                  >
                    {canEdit && (
                      <Tooltip title={t('edit')}>
                        <IconButton
                          size="small"
                          onClick={() => setEditingCategory(item)}
                        >
                          <EditTwoToneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canCreate && (
                      <Tooltip title={t('duplicate')}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={duplicatingId === item.id}
                            onClick={() => handleDuplicate(item)}
                          >
                            {duplicatingId === item.id ? (
                              <CircularProgress size="1rem" />
                            ) : (
                              <ContentCopyTwoToneIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title={t('to_delete')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <DeleteTwoToneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Box sx={{ py: 8, px: 2, textAlign: 'center' }}>
            <AssignmentTwoToneIcon
              color="disabled"
              sx={{ fontSize: 42, mb: 1 }}
            />
            <Typography variant="h5">
              {search
                ? t('no_work_order_type_found')
                : t('no_work_order_type_message')}
            </Typography>
            {!search && canCreate && (
              <Button
                startIcon={<AddTwoToneIcon />}
                onClick={() => setCreating(true)}
                sx={{ mt: 2 }}
              >
                {t('new_work_order_type')}
              </Button>
            )}
          </Box>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmText={t('to_delete')}
        question={t('confirm_delete_category')}
      />
    </Box>
  );
}
