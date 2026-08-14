import { Fragment, ReactNode, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MultipleTabsLayout from '../components/MultipleTabsLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Switch,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import ClearTwoToneIcon from '@mui/icons-material/ClearTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import RefreshTwoToneIcon from '@mui/icons-material/RefreshTwoTone';
import DescriptionTwoToneIcon from '@mui/icons-material/DescriptionTwoTone';
import EventAvailableTwoToneIcon from '@mui/icons-material/EventAvailableTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import FactCheckTwoToneIcon from '@mui/icons-material/FactCheckTwoTone';
import PhotoCameraTwoToneIcon from '@mui/icons-material/PhotoCameraTwoTone';
import ArticleTwoToneIcon from '@mui/icons-material/ArticleTwoTone';
import PlaylistAddCheckTwoToneIcon from '@mui/icons-material/PlaylistAddCheckTwoTone';
import DirectionsCarTwoToneIcon from '@mui/icons-material/DirectionsCarTwoTone';
import BorderColorTwoToneIcon from '@mui/icons-material/BorderColorTwoTone';
import BadgeTwoToneIcon from '@mui/icons-material/BadgeTwoTone';
import FingerprintTwoToneIcon from '@mui/icons-material/FingerprintTwoTone';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { TitleContext } from '../../../contexts/TitleContext';
import { useDispatch, useSelector } from '../../../store';
import {
  addCategory,
  deleteCategory,
  editCategory,
  getCategories
} from '../../../slices/category';
import useAuth from '../../../hooks/useAuth';
import Category from '../../../models/owns/category';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import { PermissionEntity } from '../../../models/owns/role';
import PermissionErrorMessage from '../components/PermissionErrorMessage';
import FeatureErrorMessage from '../components/FeatureErrorMessage';
import { ERIONE_HIDDEN_MODULES } from '../../../config/erioneModules';
import { getChecklists } from '../../../slices/checklist';
import SelectForm from '../components/form/SelectForm';
import { PlanFeature } from '../../../models/owns/subscriptionPlan';

// "Tipo de tarefa" (categoria de OS) e o unico tipo de categoria com SLA,
// questionario padrao e obrigatoriedades de fechamento. As outras 6 abas
// (Ativo, Custo, Medidor, Peca, Compra, Timer) continuam nome+descricao.
const isWorkOrderCategory = (basePath: string) =>
  basePath === 'work-order-categories';

interface TaskTypeFieldsValues {
  toleranceMinutes: string;
  // Mesma unidade (horas) do campo estimatedDuration que ja existe na OS - so
  // preenche esse campo automaticamente na criacao, nao e um dado paralelo.
  defaultEstimatedDuration: string;
  // Id do Checklist selecionado (cadastro proprio e reutilizavel em
  // /app/checklists - ver Checklists/index.tsx e ChecklistForm.tsx). A
  // Category so referencia por id, nunca cria/edita perguntas por baixo.
  checklistId: number | null;
  requireSignature: boolean;
  requireSignerName: boolean;
  requireSignerDocument: boolean;
  requirePhotos: boolean;
  requireFieldReport: boolean;
  requireMileage: boolean;
  requireChecklistCompletion: boolean;
}

const taskTypeInitialValues = (item?: any): TaskTypeFieldsValues => ({
  toleranceMinutes: item?.toleranceMinutes ?? '',
  defaultEstimatedDuration: item?.defaultEstimatedDuration ?? '',
  checklistId: item?.defaultChecklist?.id ?? null,
  requireSignature: item?.requireSignature ?? false,
  requireSignerName: item?.requireSignerName ?? false,
  requireSignerDocument: item?.requireSignerDocument ?? false,
  requirePhotos: item?.requirePhotos ?? false,
  requireFieldReport: item?.requireFieldReport ?? false,
  requireMileage: item?.requireMileage ?? false,
  requireChecklistCompletion: item?.requireChecklistCompletion ?? false
});

// Converte os campos do form para o formato esperado pela API: numeros vazios
// viram null. defaultChecklist NAO entra aqui - e resolvido a parte (async)
// porque pode exigir criar/atualizar o Checklist antes de montar o payload.
const formatTaskTypeValues = (values: TaskTypeFieldsValues) => ({
  toleranceMinutes: values.toleranceMinutes === '' ? null : Number(values.toleranceMinutes),
  defaultEstimatedDuration:
    values.defaultEstimatedDuration === ''
      ? null
      : Number(values.defaultEstimatedDuration),
  requireSignature: values.requireSignature,
  requireSignerName: values.requireSignerName,
  requireSignerDocument: values.requireSignerDocument,
  requirePhotos: values.requirePhotos,
  requireFieldReport: values.requireFieldReport,
  requireMileage: values.requireMileage,
  requireChecklistCompletion: values.requireChecklistCompletion
});

const IconButtonWrapper = styled(IconButton)(
  ({ theme }) => `
    transition: ${theme.transitions.create(['transform', 'background'])};
    transform: scale(1);
    transform-origin: center;

    &:hover {
        transform: scale(1.1);
    }
  `
);

const ListWrapper = styled(List)(
  () => `
      .MuiListItem-root:last-of-type + .MuiDivider-root {
          display: none;
      }
  `
);

// Bloco visual usado pra separar as 4 secoes do formulario de categoria
// (Informacoes basicas / Planejamento / Questionario padrao / Requisitos) -
// borda suave + espacamento consistente, sem sombra pesada.
const SectionCard = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      border: (theme) => `1px solid ${theme.colors.alpha.black[10]}`,
      borderRadius: 2,
      p: { xs: 2, sm: 2.5 }
    }}
  >
    {children}
  </Box>
);

// Icone + titulo (+ descricao curta opcional) no topo de cada SectionCard.
const SectionHeader = ({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
    <Box
      sx={{
        width: 32,
        height: 32,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 1.5,
        color: 'primary.main',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1)
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
        {title}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25 }}
        >
          {description}
        </Typography>
      )}
    </Box>
  </Box>
);

// Linha de requisito no estilo "settings toggle": icone + label + switch,
// com uma legenda curta abaixo. `indent` afasta visualmente os sub-itens da
// assinatura (nome/documento) do toggle pai "Colher assinatura" - e' so
// apresentacao, nao muda a logica: cada campo continua um boolean
// independente, sem nenhuma correcao automatica de combinacao antiga.
const RequirementToggle = ({
  icon,
  label,
  helper,
  checked,
  onChange,
  indent,
  disabled
}: {
  icon: ReactNode;
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  indent?: boolean;
  disabled?: boolean;
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 1.25,
      py: 1,
      pl: indent ? 4.5 : 0,
      opacity: disabled ? 0.5 : 1
    }}
  >
    <Box sx={{ mt: 0.25, color: 'text.secondary', display: 'flex' }}>
      {icon}
    </Box>
    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Switch
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      </Box>
      {helper && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.25, fontSize: 12.5, lineHeight: 1.4 }}
        >
          {helper}
        </Typography>
      )}
    </Box>
  </Box>
);

// Bloco informativo (nao toggle) pra "Relato do atendimento" - o validator
// exige relato sempre, incondicionalmente, entao um toggle editavel aqui
// seria enganoso (ver WorkOrderCompletionValidator.java, requireFieldReport
// nao bloqueia nada hoje). So leitura, sem Switch.
const AlwaysRequiredNotice = ({
  icon,
  label,
  helper
}: {
  icon: ReactNode;
  label: string;
  helper?: string;
}) => {
  const { t }: { t: any } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 1 }}>
      <Box sx={{ mt: 0.25, color: 'text.secondary', display: 'flex' }}>{icon}</Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Box
            component="span"
            sx={{
              px: 0.75,
              py: 0.125,
              borderRadius: 0.75,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.3,
              color: 'text.secondary',
              bgcolor: (theme) => theme.colors.alpha.black[10]
            }}
          >
            {t('always_required_badge')}
          </Box>
        </Box>
        {helper && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25, fontSize: 12.5, lineHeight: 1.4 }}
          >
            {helper}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

interface CategoriesLayoutProps {
  children?: ReactNode;
  tabIndex: number;
  basePath: string;
}

function CategoriesLayout(props: CategoriesLayoutProps) {
  const { children, tabIndex, basePath } = props;
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const [openAddCategoryModal, setOpenAddCategoryModal] =
    useState<boolean>(false);
  const [openUpdateCategoryModal, setOpenUpdateCategoryModal] =
    useState<boolean>(false);
  const [openDelete, setOpenDelete] = useState<boolean>(false);
  const handleOpenAdd = () => setOpenAddCategoryModal(true);
  const handleCloseAdd = () => setOpenAddCategoryModal(false);
  const { categories, loading } = useSelector((state) => state.categories);
  const { checklists } = useSelector((state) => state.checklists);
  const { setTitle } = useContext(TitleContext);
  const dispatch = useDispatch();
  const {
    user,
    hasViewPermission,
    hasEditPermission,
    hasCreatePermission,
    hasDeletePermission,
    hasFeature
  } = useAuth();
  const { companySettingsId } = user;
  const [currentCategory, setCurrentCategory] = useState<Category>();
  const { showSnackBar } = useContext(CustomSnackBarContext);

  const handleDelete = (id: number) => {
    dispatch(deleteCategory(id, basePath))
      .then(onDeleteSuccess)
      .catch(onDeleteFailure);
    setOpenDelete(false);
  };
  useEffect(() => {
    setTitle(t('categories'));
    if (hasViewPermission(PermissionEntity.CATEGORIES_WEB))
      dispatch(getCategories(basePath));
    if (isWorkOrderCategory(basePath)) dispatch(getChecklists());
  }, []);

  const onCreationSuccess = () => {
    handleCloseAdd();
    showSnackBar(t('category_create_success'), 'success');
  };
  const onCreationFailure = (err) =>
    showSnackBar(t('category_create_failure'), 'error');
  const onEditSuccess = () => {
    setOpenUpdateCategoryModal(false);
    showSnackBar(t('changes_saved_success'), 'success');
  };
  const onEditFailure = (err) =>
    showSnackBar(t('category_edit_failure'), 'error');
  const onDeleteSuccess = () => {
    showSnackBar(t('category_delete_success'), 'success');
  };
  const onDeleteFailure = (err) =>
    showSnackBar(t('category_delete_failure'), 'error');

  const tabs = [
    { value: '', label: t('work_orders') },
    { value: 'asset', label: t('assets') },
    ...(!ERIONE_HIDDEN_MODULES.meters
      ? [{ value: 'meter', label: t('meters') }]
      : []),
    { value: 'time', label: t('timers') },
    { value: 'cost', label: t('costs') },
    ...(!ERIONE_HIDDEN_MODULES.parts
      ? [{ value: 'part', label: t('parts') }]
      : []),
    ...(!ERIONE_HIDDEN_MODULES.purchaseOrders
      ? [{ value: 'purchase-order', label: t('purchase_orders') }]
      : [])
  ];

  // Secao 1: Nome + Descricao - igual pras 7 abas (so as de "Tipo de tarefa"
  // ganham as secoes extras abaixo).
  const renderBasicInfoFields = (
    values: { name: string; description: string },
    errors: any,
    touched: any,
    handleChange: (e: any) => void,
    handleBlur: (e: any) => void
  ) => (
    <Grid item xs={12}>
      <SectionCard>
        <SectionHeader
          icon={<DescriptionTwoToneIcon fontSize="small" />}
          title={t('category_section_basic_info')}
        />
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              error={Boolean(touched.name && errors.name)}
              fullWidth
              helperText={touched.name && errors.name}
              label={t('name')}
              name="name"
              onBlur={handleBlur}
              onChange={handleChange}
              value={values.name}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t('description')}
              multiline
              rows={2}
              name="description"
              onBlur={handleBlur}
              onChange={handleChange}
              value={values.description}
              variant="outlined"
            />
          </Grid>
        </Grid>
      </SectionCard>
    </Grid>
  );

  // Secoes 2-4: Planejamento, Questionario padrao e Requisitos para
  // conclusao - so aparecem na aba Ordens de Servico ("Tipo de tarefa").
  const renderTaskTypeFields = (
    values: TaskTypeFieldsValues,
    handleChange: (e: any) => void,
    setFieldValue: (field: string, value: any) => void
  ) => {
    if (!isWorkOrderCategory(basePath)) return null;

    const selectedChecklist = checklists.find(
      (checklist) => checklist.id === values.checklistId
    );

    return (
      <>
        {/* Secao 2 - Planejamento */}
        <Grid item xs={12}>
          <SectionCard>
            <SectionHeader
              icon={<EventAvailableTwoToneIcon fontSize="small" />}
              title={t('category_section_planning')}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={7}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('task_type_default_duration')}
                  placeholder={t('hours')}
                  helperText={t('task_type_default_duration_helper')}
                  name="defaultEstimatedDuration"
                  onChange={handleChange}
                  value={values.defaultEstimatedDuration}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={t('task_type_tolerance_minutes')}
                  name="toleranceMinutes"
                  onChange={handleChange}
                  value={values.toleranceMinutes}
                  variant="outlined"
                  InputLabelProps={{ sx: { color: 'text.secondary' } }}
                  sx={{ mt: { xs: 0, sm: 0.75 } }}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>

        {/* Secao 3 - Checklist: selecao do cadastro proprio (/app/checklists)
            + o unico requisito de conclusao que pertence conceitualmente a
            este grupo (Exigir checklist completo) - unificados no mesmo
            card pra nao separar "o que e o checklist" de "o que ele exige".
            "Criar novo"/"Editar associado" abrem o editor numa aba nova pra
            preservar este modal aberto como esta. */}
        <Grid item xs={12}>
          <SectionCard>
            <SectionHeader
              icon={<AssignmentTwoToneIcon fontSize="small" />}
              title={t('checklist_section_title')}
              description={t('task_type_checklist_section_helper')}
            />
            {!hasFeature(PlanFeature.CHECKLIST) ? (
              <FeatureErrorMessage message="upgrade_checklist" />
            ) : (
              <Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <SelectForm
                      options={checklists.map((checklist) => ({
                        label: t('checklist_option_label', {
                          name: checklist.name,
                          count: checklist.taskBases?.length ?? 0
                        }),
                        value: checklist.id
                      })) as any}
                      value={
                        (selectedChecklist
                          ? {
                              label: t('checklist_option_label', {
                                name: selectedChecklist.name,
                                count: selectedChecklist.taskBases?.length ?? 0
                              }),
                              value: selectedChecklist.id
                            }
                          : null) as any
                      }
                      label="checklist"
                      placeholder={t('search_checklist_placeholder')}
                      onChange={(event: any, option: any) =>
                        setFieldValue(
                          'checklistId',
                          option ? Number(option.value) : null
                        )
                      }
                      disabled={false}
                      error={false}
                      errorMessage={undefined}
                      fullWidth
                    />
                  </Box>
                  <IconButtonWrapper
                    size="small"
                    title={t('refresh_checklists')}
                    onClick={() => dispatch(getChecklists())}
                    sx={{ mt: 0.5 }}
                  >
                    <RefreshTwoToneIcon fontSize="small" />
                  </IconButtonWrapper>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    startIcon={<AddTwoToneIcon fontSize="small" />}
                    onClick={() => window.open('/app/checklists/new', '_blank')}
                  >
                    {t('create_new_checklist')}
                  </Button>
                  <Button
                    size="small"
                    disabled={!values.checklistId}
                    startIcon={<EditTwoToneIcon fontSize="small" />}
                    onClick={() =>
                      window.open(
                        `/app/checklists/${values.checklistId}`,
                        '_blank'
                      )
                    }
                  >
                    {t('edit_associated_checklist')}
                  </Button>
                </Box>
                <Divider sx={{ my: 2 }} />
                <RequirementToggle
                  icon={<PlaylistAddCheckTwoToneIcon fontSize="small" />}
                  label={t('task_type_require_checklist_completion')}
                  helper={
                    values.checklistId
                      ? t('category_require_checklist_completion_helper')
                      : t('checklist_completion_disabled_helper')
                  }
                  checked={!!values.checklistId && values.requireChecklistCompletion}
                  disabled={!values.checklistId}
                  onChange={(checked) =>
                    setFieldValue('requireChecklistCompletion', checked)
                  }
                />
              </Box>
            )}
          </SectionCard>
        </Grid>

        {/* Secao 4 - Requisitos para conclusao: 3 grupos que refletem a
            dependencia REAL do WorkOrderCompletionValidator (ver auditoria) -
            relato de campo NAO tem toggle porque a flag requireFieldReport
            nao bloqueia nada hoje (relato ja e sempre obrigatorio, ver
            WorkOrderCompletionValidator.java linhas 59-67). Nome/documento
            do assinante ficam desabilitados quando assinatura esta OFF, sem
            apagar o valor salvo (o backend ja ignora esses campos nesse
            caso). */}
        <Grid item xs={12}>
          <SectionCard>
            <SectionHeader
              icon={<FactCheckTwoToneIcon fontSize="small" />}
              title={t('task_type_requirements_section')}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ fontWeight: 700 }}
                >
                  {t('category_requirements_group_service')}
                </Typography>
                <RequirementToggle
                  icon={<PhotoCameraTwoToneIcon fontSize="small" />}
                  label={t('task_type_require_photos')}
                  helper={t('category_require_photos_helper')}
                  checked={values.requirePhotos}
                  onChange={(checked) =>
                    setFieldValue('requirePhotos', checked)
                  }
                />
                <AlwaysRequiredNotice
                  icon={<ArticleTwoToneIcon fontSize="small" />}
                  label={t('field_report_always_required_label')}
                  helper={t('field_report_always_required_helper')}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Divider sx={{ mb: 1 }} />
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ fontWeight: 700 }}
                >
                  {t('category_requirements_group_travel')}
                </Typography>
                <RequirementToggle
                  icon={<DirectionsCarTwoToneIcon fontSize="small" />}
                  label={t('task_type_require_mileage')}
                  helper={t('category_require_mileage_helper')}
                  checked={values.requireMileage}
                  onChange={(checked) =>
                    setFieldValue('requireMileage', checked)
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ mb: 1 }} />
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ fontWeight: 700 }}
                >
                  {t('category_requirements_group_signature')}
                </Typography>
                <RequirementToggle
                  icon={<BorderColorTwoToneIcon fontSize="small" />}
                  label={t('task_type_require_signature')}
                  helper={t('category_require_signature_helper')}
                  checked={values.requireSignature}
                  onChange={(checked) =>
                    setFieldValue('requireSignature', checked)
                  }
                />
                <RequirementToggle
                  icon={<BadgeTwoToneIcon fontSize="small" />}
                  label={t('task_type_require_signer_name')}
                  checked={values.requireSignature && values.requireSignerName}
                  disabled={!values.requireSignature}
                  onChange={(checked) =>
                    setFieldValue('requireSignerName', checked)
                  }
                  indent
                />
                <RequirementToggle
                  icon={<FingerprintTwoToneIcon fontSize="small" />}
                  label={t('task_type_require_signer_document')}
                  checked={values.requireSignature && values.requireSignerDocument}
                  disabled={!values.requireSignature}
                  onChange={(checked) =>
                    setFieldValue('requireSignerDocument', checked)
                  }
                  indent
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>
      </>
    );
  };

  const renderModal = () => (
    <Dialog
      fullWidth
      maxWidth={isWorkOrderCategory(basePath) ? 'md' : 'xs'}
      fullScreen={isWorkOrderCategory(basePath) && isMobileViewport}
      open={openAddCategoryModal}
      onClose={handleCloseAdd}
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle
        sx={{
          p: 3,
          pb: 2
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('add_category')}
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {t('add_category_description')}
        </Typography>
      </DialogTitle>
      <Formik
        initialValues={{
          name: '',
          description: null,
          ...taskTypeInitialValues()
        }}
        validationSchema={Yup.object().shape({
          name: Yup.string().max(30).required(t('required_name'))
        })}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            const checklistRef =
              isWorkOrderCategory(basePath) &&
              (values as TaskTypeFieldsValues).checklistId
                ? { id: (values as TaskTypeFieldsValues).checklistId }
                : null;
            const formattedValues = {
              name: values.name,
              description: values.description,
              companySettings: { id: companySettingsId },
              ...(isWorkOrderCategory(basePath)
                ? {
                    ...formatTaskTypeValues(values as TaskTypeFieldsValues),
                    defaultChecklist: checklistRef
                  }
                : {})
            };
            await dispatch(addCategory(formattedValues, basePath));
            onCreationSuccess();
          } catch (err) {
            onCreationFailure(err);
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
        }) => (
          <form onSubmit={handleSubmit}>
            <DialogContent
              dividers
              sx={{
                p: 3,
                bgcolor: (theme) => theme.colors.alpha.black[5]
              }}
            >
              <Grid container spacing={2.5}>
                {renderBasicInfoFields(
                  values as unknown as { name: string; description: string },
                  errors,
                  touched,
                  handleChange,
                  handleBlur
                )}
                {renderTaskTypeFields(
                  values as unknown as TaskTypeFieldsValues,
                  handleChange,
                  setFieldValue
                )}
              </Grid>
            </DialogContent>
            <DialogActions
              sx={{
                p: 2.5
              }}
            >
              <Button color="secondary" onClick={handleCloseAdd}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                startIcon={
                  isSubmitting ? <CircularProgress size="1rem" /> : null
                }
                disabled={isSubmitting}
                variant="contained"
              >
                {t('save_category')}
              </Button>
            </DialogActions>
          </form>
        )}
      </Formik>
    </Dialog>
  );
  const renderUpdateModal = () => (
    <Dialog
      fullWidth
      maxWidth={isWorkOrderCategory(basePath) ? 'md' : 'xs'}
      fullScreen={isWorkOrderCategory(basePath) && isMobileViewport}
      open={openUpdateCategoryModal}
      onClose={() => setOpenUpdateCategoryModal(false)}
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle
        sx={{
          p: 3,
          pb: 2
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('edit_category')}
        </Typography>
        <Typography variant="subtitle2" color="text.secondary">
          {t('edit_category_description')}
        </Typography>
      </DialogTitle>
      <Formik
        initialValues={{
          name: currentCategory?.name,
          description: currentCategory?.description,
          ...taskTypeInitialValues(currentCategory)
        }}
        validationSchema={Yup.object().shape({
          name: Yup.string().max(30).required(t('required_name'))
        })}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            const checklistRef =
              isWorkOrderCategory(basePath) &&
              (values as TaskTypeFieldsValues).checklistId
                ? { id: (values as TaskTypeFieldsValues).checklistId }
                : null;
            const formattedValues = {
              name: values.name,
              description: values.description,
              companySettings: { id: companySettingsId },
              ...(isWorkOrderCategory(basePath)
                ? {
                    ...formatTaskTypeValues(values as TaskTypeFieldsValues),
                    defaultChecklist: checklistRef
                  }
                : {})
            };
            await dispatch(
              editCategory(currentCategory.id, formattedValues, basePath)
            );
            onEditSuccess();
          } catch (err) {
            onEditFailure(err);
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
        }) => (
          <form onSubmit={handleSubmit}>
            <DialogContent
              dividers
              sx={{
                p: 3,
                bgcolor: (theme) => theme.colors.alpha.black[5]
              }}
            >
              <Grid container spacing={2.5}>
                {renderBasicInfoFields(
                  values as unknown as { name: string; description: string },
                  errors,
                  touched,
                  handleChange,
                  handleBlur
                )}
                {renderTaskTypeFields(
                  values as unknown as TaskTypeFieldsValues,
                  handleChange,
                  setFieldValue
                )}
              </Grid>
            </DialogContent>
            <DialogActions
              sx={{
                p: 2.5
              }}
            >
              <Button
                color="secondary"
                onClick={() => setOpenUpdateCategoryModal(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                startIcon={
                  isSubmitting ? <CircularProgress size="1rem" /> : null
                }
                disabled={isSubmitting}
                variant="contained"
              >
                {t('save_category')}
              </Button>
            </DialogActions>
          </form>
        )}
      </Formik>
    </Dialog>
  );
  if (hasViewPermission(PermissionEntity.CATEGORIES_WEB))
    return (
      <MultipleTabsLayout
        basePath="/app/categories"
        tabs={tabs}
        tabIndex={tabIndex}
        title={t('categories')}
        action={
          hasCreatePermission(PermissionEntity.CATEGORIES)
            ? handleOpenAdd
            : null
        }
        actionTitle={t('category')}
      >
        {renderModal()}
        {renderUpdateModal()}
        <Grid item xs={12}>
          <Box p={4}>
            {categories[basePath]?.length ? (
              <ListWrapper disablePadding>
                {categories[basePath].map((item) => (
                  <Fragment key={item.id}>
                    <ListItem
                      sx={{
                        display: { xs: 'block', md: 'flex' },
                        py: 1.5,
                        px: 2
                      }}
                    >
                      <ListItemText
                        disableTypography
                        primary={
                          <Typography
                            sx={{
                              display: 'block',
                              mb: 1
                            }}
                            variant="h6"
                          >
                            {item.name}
                          </Typography>
                        }
                        secondary={
                          <Typography
                            sx={{
                              display: 'block',
                              mb: 1
                            }}
                            variant="subtitle1"
                          >
                            {item.description}
                          </Typography>
                        }
                      />
                      <Box
                        component="span"
                        sx={{
                          display: 'block',
                          mt: { xs: 1, md: 0 }
                        }}
                      >
                        <Box
                          sx={{
                            ml: { xs: 0, md: 3 },
                            textAlign: { xs: 'left', md: 'right' }
                          }}
                        >
                          {hasEditPermission(
                            PermissionEntity.CATEGORIES,
                            categories[basePath].find(
                              (category) => category.id === item.id
                            )
                          ) && (
                            <IconButtonWrapper
                              onClick={() => {
                                setCurrentCategory(
                                  categories[basePath].find(
                                    (category) => category.id === item.id
                                  )
                                );
                                setOpenUpdateCategoryModal(true);
                              }}
                              sx={{
                                backgroundColor: `${theme.colors.primary.main}`,
                                color: `${theme.palette.getContrastText(
                                  theme.colors.primary.main
                                )}`,
                                transition: `${theme.transitions.create([
                                  'all'
                                ])}`,

                                '&:hover': {
                                  backgroundColor: `${theme.colors.primary.main}`,
                                  color: `${theme.palette.getContrastText(
                                    theme.colors.primary.main
                                  )}`
                                }
                              }}
                              size="small"
                            >
                              <EditTwoToneIcon fontSize="small" />
                            </IconButtonWrapper>
                          )}
                          {hasDeletePermission(
                            PermissionEntity.CATEGORIES,
                            categories[basePath].find(
                              (category) => category.id === item.id
                            )
                          ) && (
                            <IconButtonWrapper
                              onClick={() => {
                                setCurrentCategory(
                                  categories[basePath].find(
                                    (category) => category.id === item.id
                                  )
                                );
                                setOpenDelete(true);
                              }}
                              sx={{
                                ml: 1,
                                backgroundColor: `${theme.colors.error.lighter}`,
                                color: `${theme.colors.error.main}`,
                                transition: `${theme.transitions.create([
                                  'all'
                                ])}`,

                                '&:hover': {
                                  backgroundColor: `${theme.colors.error.main}`,
                                  color: `${theme.palette.getContrastText(
                                    theme.colors.error.main
                                  )}`
                                }
                              }}
                              size="small"
                            >
                              <ClearTwoToneIcon fontSize="small" />
                            </IconButtonWrapper>
                          )}
                        </Box>
                      </Box>
                    </ListItem>
                    <Divider sx={{ mt: 1 }} />
                  </Fragment>
                ))}
              </ListWrapper>
            ) : loading[basePath] ? (
              <Box display="flex" flexDirection="column" alignItems="center">
                <CircularProgress />
              </Box>
            ) : (
              <Box display="flex" flexDirection="column" alignItems="center">
                <Typography variant="h4">
                  {t('no_category_message', {
                    categoryName: tabs[tabIndex].label
                  })}
                </Typography>
                <Typography sx={{ mt: 1 }} variant="h6">
                  {t('no_category_action')}
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>
        <ConfirmDialog
          open={openDelete}
          onCancel={() => {
            setOpenDelete(false);
          }}
          onConfirm={() => handleDelete(currentCategory?.id)}
          confirmText={t('to_delete')}
          question={t('confirm_delete_category')}
        />
      </MultipleTabsLayout>
    );
  else return <PermissionErrorMessage message={'no_access_categories'} />;
}

export default CategoriesLayout;
