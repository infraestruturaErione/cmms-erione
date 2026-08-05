import { Fragment, ReactNode, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MultipleTabsLayout from '../components/MultipleTabsLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import ClearTwoToneIcon from '@mui/icons-material/ClearTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
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
import { addChecklist, editChecklist, getChecklists } from '../../../slices/checklist';
import { Checklist } from '../../../models/owns/checklists';
import { Task, TaskType } from '../../../models/owns/tasks';
import { getTaskFromTaskBase } from '../../../utils/formatters';
import { randomInt } from '../../../utils/generators';
import { reorder } from '../../../utils/items';
import DraggableTaskList, {
  DraggableListProps
} from '../components/form/SelectTasks/DraggableTaskList';
import { AssetMiniDTO } from '../../../models/owns/asset';
import { UserMiniDTO } from '../../../models/user';
import { MeterMiniDTO } from '../../../models/owns/meter';
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
  // Id do Checklist ja existente por baixo (null se a categoria ainda nao tem
  // um). O usuario nunca escolhe isso num dropdown - so edita as perguntas
  // (checklistTasks) e o id e criado/reaproveitado na hora de salvar.
  checklistId: number | null;
  checklistTasks: Task[];
  requireSignature: boolean;
  requireSignerName: boolean;
  requireSignerDocument: boolean;
  requirePhotos: boolean;
  requireFieldReport: boolean;
  requireMileage: boolean;
  requireChecklistCompletion: boolean;
}

const taskTypeInitialValues = (
  checklists: Checklist[],
  item?: any
): TaskTypeFieldsValues => {
  const existingChecklist = item?.defaultChecklist?.id
    ? checklists.find(
        (checklist) => checklist.id === item.defaultChecklist.id
      )
    : undefined;
  return {
    toleranceMinutes: item?.toleranceMinutes ?? '',
    defaultEstimatedDuration: item?.defaultEstimatedDuration ?? '',
    checklistId: item?.defaultChecklist?.id ?? null,
    checklistTasks: existingChecklist
      ? existingChecklist.taskBases.map((taskBase) =>
          getTaskFromTaskBase(taskBase)
        )
      : [],
    requireSignature: item?.requireSignature ?? false,
    requireSignerName: item?.requireSignerName ?? false,
    requireSignerDocument: item?.requireSignerDocument ?? false,
    requirePhotos: item?.requirePhotos ?? false,
    requireFieldReport: item?.requireFieldReport ?? false,
    requireMileage: item?.requireMileage ?? false,
    requireChecklistCompletion: item?.requireChecklistCompletion ?? false
  };
};

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

const buildTaskBases = (tasks: Task[]) =>
  tasks.map((task) => ({
    ...task.taskBase,
    options: task.taskBase.options.map((option) => option.label)
  }));

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
  // Confirmacao antes de remover UM item do checklist (nao a categoria
  // inteira). Usa Popover ancorado no botao em vez de outro Dialog: dois
  // MUI Dialog empilhados (o de editar categoria + um ConfirmDialog por
  // cima) renderizava o segundo fora da viewport (bug de posicionamento do
  // Slide transition quando aninhado). Popover nao tem esse problema.
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<{
    anchorEl: HTMLElement;
    confirm: () => void;
  } | null>(null);
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

  // Cria/atualiza o Checklist por baixo do formulario de categoria - o
  // usuario nunca precisa visitar Configuracoes > Checklists pra isso. Esse
  // registro de Checklist continua existindo (e' reaproveitado por Workflows),
  // so deixou de ser um passo manual separado no fluxo normal.
  const persistCategoryChecklist = async (
    values: TaskTypeFieldsValues,
    categoryName: string
  ): Promise<{ id: number } | null> => {
    if (!values.checklistTasks.length) return null;
    const checklistPayload = {
      name: categoryName,
      description: '',
      category: '',
      taskBases: buildTaskBases(values.checklistTasks)
    };
    if (values.checklistId) {
      await dispatch(editChecklist(values.checklistId, checklistPayload));
      return { id: values.checklistId };
    }
    const created: Checklist = await dispatch(
      addChecklist(checklistPayload, companySettingsId)
    );
    return created ? { id: created.id } : null;
  };

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
  // Campos extras de "Tipo de tarefa": SLA (tolerancia/duracao padrao),
  // questionario padrao (itens do checklist geridos aqui mesmo, sem tela
  // separada) e as obrigatoriedades de fechamento. So aparece na aba Ordens
  // de Serviço.
  const renderTaskTypeFields = (
    values: TaskTypeFieldsValues,
    handleChange: (e: any) => void,
    setFieldValue: (field: string, value: any) => void
  ) => {
    if (!isWorkOrderCategory(basePath)) return null;

    const updateTask = (id: number, updater: (task: Task) => Task) =>
      setFieldValue(
        'checklistTasks',
        values.checklistTasks.map((task) =>
          task.id === id ? updater(task) : task
        )
      );
    const addChecklistItem = () =>
      setFieldValue('checklistTasks', [
        ...values.checklistTasks,
        {
          id: randomInt(),
          taskBase: { id: randomInt(), label: '', taskType: 'SUBTASK' },
          notes: '',
          images: []
        }
      ]);
    const onLabelChange = (value: string, id: number) =>
      updateTask(id, (task) => ({
        ...task,
        taskBase: { ...task.taskBase, label: value }
      }));
    const onTypeChange = (value: TaskType, id: number) =>
      updateTask(id, (task) => ({
        ...task,
        taskBase: {
          ...task.taskBase,
          taskType: value,
          meter: value === 'METER' ? task.taskBase.meter : null
        }
      }));
    const onUserChange = (user: UserMiniDTO, id: number) =>
      updateTask(id, (task) => ({
        ...task,
        taskBase: { ...task.taskBase, user }
      }));
    const onAssetChange = (asset: AssetMiniDTO, id: number) =>
      updateTask(id, (task) => ({
        ...task,
        taskBase: { ...task.taskBase, asset }
      }));
    const onMeterChange = (meter: MeterMiniDTO, id: number) =>
      updateTask(id, (task) => ({
        ...task,
        taskBase: { ...task.taskBase, meter }
      }));
    const onChoicesChange = (choices: string[], id: number) =>
      updateTask(id, (task) => ({
        ...task,
        taskBase: {
          ...task.taskBase,
          options: choices.map((choice) => ({ id: randomInt(), label: choice }))
        }
      }));
    const onDragEndChecklist: DraggableListProps['onDragEnd'] = ({
      destination,
      source
    }) => {
      if (!destination) return;
      setFieldValue(
        'checklistTasks',
        reorder(values.checklistTasks, source.index, destination.index)
      );
    };
    const requestRemoveItem = (id: number, anchorEl?: HTMLElement) =>
      setConfirmRemoveItem({
        anchorEl,
        confirm: () => {
          setFieldValue(
            'checklistTasks',
            values.checklistTasks.filter((task) => task.id !== id)
          );
          setConfirmRemoveItem(null);
        }
      });

    return (
      <>
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">
            {t('task_type_sla_section')}
          </Typography>
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            type="number"
            label={t('task_type_tolerance_minutes')}
            name="toleranceMinutes"
            onChange={handleChange}
            value={values.toleranceMinutes}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={6}>
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
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">
            {t('task_type_default_checklist')}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1.5 }}
          >
            {t('task_type_checklist_section_helper')}
          </Typography>
          {!hasFeature(PlanFeature.CHECKLIST) ? (
            <FeatureErrorMessage message="upgrade_checklist" />
          ) : (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: (theme) => `1px solid ${theme.colors.alpha.black[10]}`,
                backgroundColor: (theme) => theme.colors.alpha.black[5]
              }}
            >
              {values.checklistTasks.length ? (
                <DraggableTaskList
                  tasks={values.checklistTasks}
                  onDragEnd={onDragEndChecklist}
                  onLabelChange={onLabelChange}
                  onTypeChange={onTypeChange}
                  onRemove={requestRemoveItem}
                  onUserChange={onUserChange}
                  onAssetChange={onAssetChange}
                  onMeterChange={onMeterChange}
                  onChoicesChange={onChoicesChange}
                />
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: 'center' }}
                >
                  {t('task_type_checklist_empty')}
                </Typography>
              )}
              <Button
                size="small"
                startIcon={<AddTwoToneIcon fontSize="small" />}
                onClick={addChecklistItem}
              >
                {t('task_type_checklist_add_item')}
              </Button>
            </Box>
          )}
        </Grid>
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">
            {t('task_type_requirements_section')}
          </Typography>
        </Grid>
        {(
          [
            ['requireSignature', 'task_type_require_signature'],
            ['requireSignerName', 'task_type_require_signer_name'],
            ['requireSignerDocument', 'task_type_require_signer_document'],
            ['requirePhotos', 'task_type_require_photos'],
            ['requireFieldReport', 'task_type_require_field_report'],
            ['requireMileage', 'task_type_require_mileage'],
            [
              'requireChecklistCompletion',
              'task_type_require_checklist_completion'
            ]
          ] as const
        ).map(([field, labelKey]) => (
          <Grid item xs={12} sm={6} key={field}>
            <FormControlLabel
              control={
                <Checkbox
                  name={field}
                  checked={values[field]}
                  onChange={handleChange}
                />
              }
              label={t(labelKey)}
            />
          </Grid>
        ))}
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
    >
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('add_category')}
        </Typography>
        <Typography variant="subtitle2">
          {t('add_category_description')}
        </Typography>
      </DialogTitle>
      <Formik
        initialValues={{
          name: '',
          description: null,
          ...taskTypeInitialValues(checklists)
        }}
        validationSchema={Yup.object().shape({
          name: Yup.string().max(30).required(t('required_name'))
        })}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            const checklistRef = isWorkOrderCategory(basePath)
              ? await persistCategoryChecklist(
                  values as TaskTypeFieldsValues,
                  values.name
                )
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
                p: 3
              }}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} lg={12}>
                  <Grid container spacing={3}>
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
                        rows={3}
                        name="description"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        value={values.description}
                        variant="outlined"
                      />
                    </Grid>
                    {renderTaskTypeFields(
                      values as unknown as TaskTypeFieldsValues,
                      handleChange,
                      setFieldValue
                    )}
                  </Grid>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions
              sx={{
                p: 3
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
                {t('add_category')}
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
    >
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('edit_category')}
        </Typography>
        <Typography variant="subtitle2">
          {t('edit_category_description')}
        </Typography>
      </DialogTitle>
      <Formik
        initialValues={{
          name: currentCategory?.name,
          description: currentCategory?.description,
          ...taskTypeInitialValues(checklists, currentCategory)
        }}
        validationSchema={Yup.object().shape({
          name: Yup.string().max(30).required(t('required_name'))
        })}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            const checklistRef = isWorkOrderCategory(basePath)
              ? await persistCategoryChecklist(
                  values as TaskTypeFieldsValues,
                  values.name
                )
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
                p: 3
              }}
            >
              <Grid container spacing={3}>
                <Grid item xs={12} lg={12}>
                  <Grid container spacing={3}>
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
                        rows={3}
                        name="description"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        value={values.description}
                        variant="outlined"
                      />
                    </Grid>
                    {renderTaskTypeFields(
                      values as unknown as TaskTypeFieldsValues,
                      handleChange,
                      setFieldValue
                    )}
                  </Grid>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions
              sx={{
                p: 3
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
                {t('save')}
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
        <Popover
          open={!!confirmRemoveItem}
          anchorEl={confirmRemoveItem?.anchorEl}
          onClose={() => setConfirmRemoveItem(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ p: 2, maxWidth: 260 }}>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {t('task_type_checklist_confirm_remove_item')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button size="small" onClick={() => setConfirmRemoveItem(null)}>
                {t('cancel')}
              </Button>
              <Button
                size="small"
                color="error"
                variant="contained"
                onClick={() => confirmRemoveItem?.confirm()}
              >
                {t('to_delete')}
              </Button>
            </Box>
          </Box>
        </Popover>
      </MultipleTabsLayout>
    );
  else return <PermissionErrorMessage message={'no_access_categories'} />;
}

export default CategoriesLayout;
