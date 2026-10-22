import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { FormikProps } from 'formik';
import { ObjectSchema } from 'yup';
import { useTranslation } from 'react-i18next';
import Form, { RenderedFormField } from '../../components/form';
import { IField, IHash } from '../../type';
import { useBrand } from '../../../../hooks/useBrand';
import { useDispatch, useSelector } from '../../../../store';
import { getCategories } from '../../../../slices/category';
import { ERIONE_VISUAL_IDENTITY as BRAND } from '../../../../config/erioneVisualIdentity';

interface Props {
  open: boolean;
  onClose: () => void;
  workOrderCode?: string;
  fields: IField[];
  values: IHash<any>;
  validation: ObjectSchema<any>;
  onChange?: any;
  onSubmit: (values: IHash<any>) => Promise<any>;
}

const PLANNING = ['estimatedStartDate', 'dueDate', 'estimatedDuration'];
const PEOPLE = ['primaryUser', 'assignedTo', 'team'];
const ATTACHMENTS = ['files', 'image'];
const DESTINATION = ['customers', 'location', 'asset'];
const SERVICE = [
  'title',
  'description',
  'category',
  'priority',
  'requiredSignature'
];
const GROUPED = new Set([
  ...PLANNING,
  ...PEOPLE,
  ...ATTACHMENTS,
  ...DESTINATION,
  ...SERVICE,
  'assetStatus',
  'tasks'
]);
const HALF_WIDTH = new Set([
  'priority',
  'requiredSignature',
  'estimatedStartDate',
  'dueDate'
]);

export const getEditWorkOrderTab = (name: string) =>
  ATTACHMENTS.includes(name)
    ? 2
    : [...PLANNING, ...PEOPLE].includes(name)
    ? 1
    : 0;

function Section({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" className="wo-edit-card">
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="flex-start"
        sx={{ mb: 2.5 }}
      >
        <Box className="wo-edit-section-icon">{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h3"
            variant="h4"
            sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.35 }}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, lineHeight: 1.6 }}
          >
            {description}
          </Typography>
        </Box>
      </Stack>
      {children}
    </Box>
  );
}

export default function EditWorkOrderTabbedModal(props: Props) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const { logo, name: brandName } = useBrand();
  const { categories } = useSelector((state) => state.categories);
  const dispatch = useDispatch();
  const hasCategoryField = props.fields.some(
    (field) => field.name === 'category'
  );
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [categoryLoadFailed, setCategoryLoadFailed] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [validationMessage, setValidationMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const light = theme.palette.mode === 'light';
  const surface = light ? '#fff' : theme.palette.background.paper;

  useEffect(() => {
    if (props.open) {
      setActiveTab(0);
      setValidationMessage(false);
    }
  }, [props.open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);

  // The read-only template must be available without opening the type selector.
  useEffect(() => {
    if (
      !props.open ||
      !hasCategoryField ||
      (categories['work-order-categories'] !== undefined &&
        categoryAttempt === 0)
    )
      return;
    let active = true;
    setCategoryLoading(true);
    setCategoryLoadFailed(false);
    dispatch(getCategories('work-order-categories'))
      .catch(() => {
        if (active) setCategoryLoadFailed(true);
      })
      .finally(() => {
        if (active) setCategoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [props.open, hasCategoryField, dispatch, categoryAttempt]);

  // Only presentation metadata changes; preserve field constraints and payloads.
  const fields = props.fields
    .filter((field) => field.type !== 'titleGroupField')
    .map((field) => ({
      ...field,
      midWidth: HALF_WIDTH.has(field.name) || field.midWidth,
      ...(field.name === 'description' ? { rows: 4 } : {}),
      ...(field.type === 'file'
        ? { fileVariant: 'light' as const, fileHideDescription: true }
        : {}),
      ...(field.name === 'requiredSignature' ? { compact: true } : {}),
      ...(['category', 'tasks'].includes(field.name)
        ? { hideCategoryChecklistAlert: true }
        : {})
    }));

  const close = () => {
    if (!savingRef.current) props.onClose();
  };
  const save = async (formik: FormikProps<IHash<any>>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const errors = await formik.validateForm();
      const names = Object.keys(errors);
      if (names.length) {
        formik.setTouched(
          names.reduce((result, name) => ({ ...result, [name]: true }), {}),
          false
        );
        setActiveTab(getEditWorkOrderTab(names[0]));
        setValidationMessage(true);
        return;
      }
      setValidationMessage(false);
      await formik.submitForm();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const renderLayout = (
    items: RenderedFormField[],
    formik: FormikProps<IHash<any>>
  ) => {
    const byName = new Map(items.map((item) => [item.field.name, item.node]));
    const hasAny = (names: string[]) => names.some((name) => byName.has(name));
    const renderFields = (names: string[]) => (
      <Grid container spacing={2}>
        {names.map((name) => byName.get(name))}
      </Grid>
    );
    const extraFields = items
      .filter(({ field }) => !GROUPED.has(field.name))
      .map(({ field }) => field.name);
    const checklist = categories['work-order-categories']?.find(
      (category) => category.id === Number(formik.values.category?.value)
    )?.defaultChecklist;
    const needsRequiredAsset =
      props.fields.some((field) => field.name === 'asset' && field.required) &&
      (!formik.values.asset || Boolean(formik.errors.asset));
    const attachmentCount = ATTACHMENTS.reduce((count, name) => {
      const value = formik.values[name];
      return count + (Array.isArray(value) ? value.length : value ? 1 : 0);
    }, 0);
    const disabled = isSaving || formik.isSubmitting;

    return (
      <Grid
        item
        xs={12}
        onKeyDownCapture={(event) => {
          const input = event.target as HTMLInputElement;
          if (
            event.key !== 'Enter' ||
            event.shiftKey ||
            !fields.some(
              (field) =>
                field.name === input.name &&
                ['text', 'number'].includes(field.type) &&
                !field.multiple
            )
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          void save(formik).catch(() => {
            /* The caller displays API errors. */
          });
        }}
        sx={{
          p: '0 !important',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_event, value) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label={t(
            'wo_edit_tabs_label',
            'Seções da edição da ordem de serviço'
          )}
          sx={{
            flexShrink: 0,
            height: 'auto',
            minHeight: 64,
            overflow: 'hidden',
            px: { xs: 1.5, sm: 3 },
            py: 1.25,
            bgcolor: surface,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTabs-indicator': { display: 'none !important' },
            '& .MuiTabs-scroller': {
              overflowX: 'auto !important',
              overflowY: 'hidden !important'
            },
            '& .MuiTabs-flexContainer': { alignItems: 'center', gap: 0.75 },
            '& .MuiTab-root.MuiButtonBase-root': {
              height: 40,
              minHeight: 40,
              minWidth: 0,
              px: { xs: 1.25, sm: 1.75 },
              m: 0,
              borderRadius: 1.25,
              fontSize: 13,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: alpha(BRAND.primary, 0.05) },
              '&.Mui-focusVisible': {
                outline: `2px solid ${
                  light ? BRAND.primary : theme.palette.primary.light
                }`,
                outlineOffset: -2
              }
            },
            '& .MuiTab-root.Mui-selected': {
              color: '#fff !important',
              bgcolor: BRAND.primary,
              '&:hover': { bgcolor: BRAND.primary }
            }
          }}
        >
          {[
            t('wo_edit_general', 'Geral'),
            t('wo_edit_planning', 'Planejamento e responsáveis'),
            t('wo_edit_attachments', 'Anexos')
          ].map((label, index) => (
            <Tab
              key={index}
              id={`wo-edit-tab-${index}`}
              aria-controls={`wo-edit-panel-${index}`}
              aria-label={label}
              disabled={disabled}
              label={
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  {index === 1 ? (
                    <>
                      <Box
                        component="span"
                        sx={{ display: { xs: 'inline', sm: 'none' } }}
                      >
                        {t('wo_edit_planning_short', 'Planejamento')}
                      </Box>
                      <Box
                        component="span"
                        sx={{ display: { xs: 'none', sm: 'inline' } }}
                      >
                        {label}
                      </Box>
                    </>
                  ) : (
                    <span>{label}</span>
                  )}
                  {index === 2 && attachmentCount > 0 && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: 11,
                        px: 0.75,
                        borderRadius: 1,
                        bgcolor: alpha(BRAND.primary, 0.08)
                      }}
                    >
                      {attachmentCount}
                    </Box>
                  )}
                </Stack>
              }
            />
          ))}
        </Tabs>
        <Box
          ref={scrollRef}
          sx={{
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            flex: 1,
            p: { xs: 2, sm: 3 },
            overscrollBehavior: 'contain'
          }}
        >
          {validationMessage && Object.keys(formik.errors).length > 0 && (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>
              {t(
                'wo_edit_validation',
                'Confira os campos indicados antes de salvar. Seus dados continuam preenchidos nas outras abas.'
              )}
            </Alert>
          )}
          <Box
            role="tabpanel"
            id="wo-edit-panel-0"
            aria-labelledby="wo-edit-tab-0"
            hidden={activeTab !== 0}
          >
            <Box className="wo-edit-columns">
              <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                {hasAny(SERVICE) && (
                  <Section
                    title={t('wo_edit_service', 'Serviço solicitado')}
                    description={t(
                      'wo_edit_service_helper',
                      'Revise o que será realizado e os requisitos do atendimento.'
                    )}
                    icon={<BuildOutlinedIcon />}
                  >
                    {renderFields(['title', 'description'])}
                    <Box
                      sx={{
                        mt: 2.5,
                        pt: 2.5,
                        borderTop: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      {renderFields(['category'])}
                      <Box sx={{ mt: 2 }}>
                        {renderFields(['priority', 'requiredSignature'])}
                      </Box>
                    </Box>
                  </Section>
                )}
              </Stack>
              <Stack spacing={2.5} sx={{ minWidth: 0 }}>
                {hasAny(DESTINATION) && (
                  <Section
                    title={t('wo_edit_destination', 'Cliente e endereço')}
                    description={t(
                      'wo_edit_destination_helper',
                      'Confirme o cliente e o local deste atendimento.'
                    )}
                    icon={<PlaceOutlinedIcon />}
                  >
                    {renderFields(['customers', 'location'])}
                    {needsRequiredAsset && (
                      <Box sx={{ mt: 2 }}>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          {t(
                            'wo_edit_required_asset',
                            'A configuração da empresa exige um equipamento. Selecione um para salvar esta OS.'
                          )}
                        </Alert>
                        {renderFields(['asset'])}
                      </Box>
                    )}
                  </Section>
                )}
                {byName.has('category') && (
                  <Section
                    title={t('wo_edit_questionnaire', 'Questionário da OS')}
                    description={t(
                      'wo_edit_questionnaire_helper',
                      'Consulte o vínculo com o tipo de tarefa e revise os itens da ordem.'
                    )}
                    icon={<AssignmentOutlinedIcon />}
                  >
                    {checklist ? (
                      <Box
                        sx={{
                          p: 1.75,
                          borderRadius: 1.5,
                          bgcolor: alpha(BRAND.primary, 0.05),
                          borderLeft: `3px solid ${BRAND.primary}`
                        }}
                      >
                        <Typography
                          variant="overline"
                          sx={{
                            color: light ? BRAND.primary : 'primary.light',
                            fontWeight: 800,
                            lineHeight: 1.6
                          }}
                        >
                          {t(
                            'wo_edit_linked_questionnaire',
                            'Vinculado ao tipo de tarefa'
                          )}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
                        >
                          {checklist.name}
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          p: 1.75,
                          borderRadius: 1.5,
                          bgcolor: alpha(BRAND.primary, 0.035)
                        }}
                      >
                        {!formik.values.category ? (
                          <Typography variant="body2" color="text.secondary">
                            {t(
                              'wo_edit_choose_task_type',
                              'Selecione o tipo de tarefa para consultar o questionário vinculado.'
                            )}
                          </Typography>
                        ) : categoryLoadFailed ? (
                          <>
                            <Typography variant="body2" color="text.secondary">
                              {t(
                                'wo_edit_questionnaire_failure',
                                'Não foi possível consultar o vínculo do questionário. Os itens e respostas da OS permanecem preservados.'
                              )}
                            </Typography>
                            <Button
                              size="small"
                              onClick={() =>
                                setCategoryAttempt((attempt) => attempt + 1)
                              }
                              disabled={categoryLoading}
                            >
                              {t('retry', 'Tentar novamente')}
                            </Button>
                          </>
                        ) : categoryLoading ||
                          categories['work-order-categories'] === undefined ? (
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                            role="status"
                          >
                            <CircularProgress size={16} />
                            <Typography variant="body2">
                              {t(
                                'wo_edit_questionnaire_loading',
                                'Consultando questionário vinculado...'
                              )}
                            </Typography>
                          </Stack>
                        ) : (
                          <>
                            <Typography variant="body2" fontWeight={700}>
                              {t(
                                'wo_add_no_default_checklist',
                                'Sem questionário padrão'
                              )}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5 }}
                            >
                              {t(
                                'wo_edit_questionnaire_preserved',
                                'Os itens e respostas já existentes nesta OS serão preservados.'
                              )}
                            </Typography>
                          </>
                        )}
                      </Box>
                    )}
                  </Section>
                )}
                {extraFields.length > 0 && (
                  <Section
                    title={t('wo_edit_details', 'Informações complementares')}
                    description={t(
                      'wo_edit_details_helper',
                      'Campos configurados para a operação da sua empresa.'
                    )}
                    icon={<AssignmentOutlinedIcon />}
                  >
                    {renderFields(extraFields)}
                  </Section>
                )}
              </Stack>
            </Box>
          </Box>
          <Box
            role="tabpanel"
            id="wo-edit-panel-1"
            aria-labelledby="wo-edit-tab-1"
            hidden={activeTab !== 1}
          >
            <Box className="wo-edit-columns">
              {hasAny(PLANNING) && (
                <Section
                  title={t('wo_edit_schedule', 'Planejamento do atendimento')}
                  description={t(
                    'wo_edit_schedule_helper',
                    'Organize o início previsto, o prazo e a duração estimada.'
                  )}
                  icon={<EventOutlinedIcon />}
                >
                  {renderFields(PLANNING)}
                </Section>
              )}
              {hasAny(PEOPLE) && (
                <Section
                  title={t('wo_edit_people', 'Responsáveis pela execução')}
                  description={t(
                    'wo_edit_people_helper',
                    'Revise o trabalhador principal, os adicionais e a equipe vinculada.'
                  )}
                  icon={<PeopleOutlineRoundedIcon />}
                >
                  {renderFields(PEOPLE)}
                </Section>
              )}
            </Box>
          </Box>
          <Box
            role="tabpanel"
            id="wo-edit-panel-2"
            aria-labelledby="wo-edit-tab-2"
            hidden={activeTab !== 2}
          >
            <Section
              title={t('wo_edit_attachments', 'Anexos')}
              description={t(
                'wo_edit_attachments_helper',
                'Consulte os arquivos atuais ou adicione materiais de apoio à OS.'
              )}
              icon={<AttachFileRoundedIcon />}
            >
              <Box className="wo-edit-columns">
                {ATTACHMENTS.filter((name) => byName.has(name)).map((name) => (
                  <Grid container spacing={2} key={name}>
                    {byName.get(name)}
                  </Grid>
                ))}
              </Box>
              {!hasAny(ATTACHMENTS) && (
                <Typography color="text.secondary">
                  {t(
                    'wo_edit_no_attachments',
                    'Não há campos de anexos disponíveis para esta OS.'
                  )}
                </Typography>
              )}
            </Section>
          </Box>
        </Box>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{
            flexShrink: 0,
            px: { xs: 2, sm: 3 },
            py: 2,
            bgcolor: surface,
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700}>
              {t('wo_edit_footer', 'Tudo pronto para atualizar?')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(
                'wo_edit_footer_helper',
                'As alterações são aplicadas ao salvar.'
              )}
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              ml: 'auto !important',
              width: { xs: '100%', sm: 'auto' },
              justifyContent: 'flex-end'
            }}
          >
            <Button
              disabled={disabled}
              onClick={close}
              sx={{ color: 'text.secondary', px: 2 }}
            >
              {t('cancel', 'Cancelar')}
            </Button>
            <Button
              variant="contained"
              disabled={disabled}
              onClick={() => {
                void save(formik).catch(() => {
                  /* The existing submit handler displays the API failure. */
                });
              }}
              startIcon={
                disabled ? (
                  <CircularProgress size={17} color="inherit" />
                ) : (
                  <SaveOutlinedIcon />
                )
              }
              sx={{
                px: { xs: 2, sm: 2.5 },
                py: 1.25,
                borderRadius: 1.5,
                bgcolor: BRAND.primary,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#213B80', boxShadow: 'none' },
                '&.Mui-disabled': { bgcolor: alpha(BRAND.primary, 0.15) }
              }}
            >
              {disabled
                ? t('wo_edit_saving', 'Salvando...')
                : t('wo_edit_save', 'Salvar alterações')}
            </Button>
          </Stack>
        </Stack>
      </Grid>
    );
  };

  return (
    <Dialog
      open={props.open}
      onClose={close}
      maxWidth={false}
      aria-labelledby="wo-edit-title"
      aria-describedby="wo-edit-description"
      disableEscapeKeyDown={isSaving}
      PaperProps={{
        sx: {
          width: { xs: 'calc(100vw - 16px)', sm: '94vw' },
          maxWidth: 1180,
          height: {
            xs: 'calc(100vh - 16px)',
            sm: 'min(850px, calc(100vh - 48px))'
          },
          maxHeight: { xs: 'calc(100vh - 16px)', sm: 'calc(100vh - 48px)' },
          '@supports (height: 100dvh)': {
            height: {
              xs: 'calc(100dvh - 16px)',
              sm: 'min(850px, calc(100dvh - 48px))'
            },
            maxHeight: { xs: 'calc(100dvh - 16px)', sm: 'calc(100dvh - 48px)' }
          },
          m: { xs: 1, sm: 3 },
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: light ? BRAND.surface : 'background.default',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: `0 24px 80px ${alpha('#03111F', 0.25)}`,
          '& .wo-edit-columns': {
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(0, 1.15fr) minmax(0, 1fr)'
            },
            gap: 2.5,
            alignItems: 'start'
          },
          '& .wo-edit-card': {
            p: { xs: 2, sm: 2.5 },
            minWidth: 0,
            border: '1px solid',
            borderColor: light ? alpha(BRAND.primary, 0.12) : 'divider',
            borderRadius: 2,
            bgcolor: surface
          },
          '& .wo-edit-section-icon': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: 1.25,
            bgcolor: alpha(BRAND.primary, 0.07),
            color: light ? BRAND.primary : 'primary.light'
          },
          '& .MuiInputBase-root': { borderRadius: 1.5 },
          '& .MuiGrid-item': { minWidth: 0 },
          '& .MuiFormControl-root': { minWidth: 0, maxWidth: '100%' },
          '& .MuiButton-root': { textTransform: 'none', fontWeight: 700 }
        }
      }}
      BackdropProps={{ sx: { bgcolor: alpha('#102A3A', 0.45) } }}
    >
      <DialogTitle
        id="wo-edit-heading"
        component="div"
        sx={{
          flexShrink: 0,
          p: { xs: 2, sm: 3 },
          color: '#fff',
          background: `radial-gradient(ellipse at top right, ${alpha(
            BRAND.primary,
            0.7
          )}, transparent 70%), linear-gradient(110deg, ${
            BRAND.primaryDarker
          }, ${BRAND.primaryDark})`,
          borderBottom: `3px solid ${BRAND.primary}`,
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            height: 3,
            bottom: -3,
            left: 0,
            width: 64,
            bgcolor: BRAND.accent
          }
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          {(logo.dark || logo.white) && (
            <Box
              component="img"
              src={logo.dark || logo.white}
              alt={brandName}
              sx={{
                width: { xs: 40, sm: 48 },
                height: { xs: 40, sm: 48 },
                p: 0.75,
                borderRadius: 1.5,
                bgcolor: '#fff',
                objectFit: 'contain',
                flexShrink: 0
              }}
            />
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="overline"
              sx={{
                color: alpha('#fff', 0.7),
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                lineHeight: 1.6
              }}
            >
              {props.workOrderCode || brandName}
            </Typography>
            <Typography
              component="h2"
              id="wo-edit-title"
              sx={{
                fontSize: { xs: 20, sm: 25 },
                fontWeight: 800,
                lineHeight: 1.3,
                color: '#fff',
                overflowWrap: 'anywhere'
              }}
            >
              {t('wo_edit_title', 'Editar ordem de serviço')}
            </Typography>
            <Typography
              id="wo-edit-description"
              variant="body2"
              sx={{ mt: 0.5, color: alpha('#fff', 0.75), lineHeight: 1.5 }}
            >
              {t(
                'wo_edit_subtitle',
                'Revise os dados, organize os responsáveis e mantenha a OS atualizada.'
              )}
            </Typography>
          </Box>
          <IconButton
            aria-label={t('close', 'Fechar')}
            disabled={isSaving}
            onClick={close}
            size="small"
            sx={{
              color: '#fff',
              bgcolor: alpha('#fff', 0.08),
              flexShrink: 0,
              '&:hover': { bgcolor: alpha('#fff', 0.15) }
            }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Form
          fields={fields}
          values={props.values}
          validation={props.validation}
          onChange={props.onChange}
          onSubmit={async (values) => {
            savingRef.current = true;
            setIsSaving(true);
            try {
              await props.onSubmit(values);
            } finally {
              savingRef.current = false;
              setIsSaving(false);
            }
          }}
          midWidthBreakpoint="md"
          hideBottomActions
          renderFieldLayout={renderLayout}
          containerSx={{
            m: 0,
            width: '100%',
            minWidth: 0,
            minHeight: 0,
            flex: 1,
            flexWrap: 'nowrap',
            flexDirection: 'column'
          }}
        />
      </Box>
    </Dialog>
  );
}
