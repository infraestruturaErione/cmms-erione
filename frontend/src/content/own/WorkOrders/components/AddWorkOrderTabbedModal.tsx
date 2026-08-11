import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Step,
  StepButton,
  Stepper,
  Typography,
  useMediaQuery
} from '@mui/material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { FormikProps } from 'formik';
import { ChangeEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from '../../components/form';
import { IField, IHash } from '../../type';
import { ObjectSchema } from 'yup';
import { useSelector } from '../../../../store';
import { LocationMiniDTO } from '../../../../models/owns/location';
import LocationMiniMap from '../Details/LocationMiniMap';
import { useBrand } from '../../../../hooks/useBrand';
import { ERIONE_VISUAL_IDENTITY } from '../../../../config/erioneVisualIdentity';

// Mesma identidade visual usada no Header/Sidebar/Login (config compartilhada
// - ver erioneVisualIdentity.ts). O modal antes usava so theme.palette.primary
// (azul generico do tema MUI, #5569ff) - trocando pelos tons reais da marca
// (#2A4899 navy + acento #E11D48) o modal fica visualmente consistente com o
// resto do app em vez de destoar.
const BRAND = ERIONE_VISUAL_IDENTITY;

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

const TAB_CONFIG: { key: string; label: string; fieldNames: string[] }[] = [
  {
    key: 'pedido',
    label: 'Pedido',
    fieldNames: [
      'title',
      'description',
      'priority',
      'category',
      'assetStatus',
      'requiredSignature'
    ]
  },
  {
    key: 'destino',
    label: 'Destino',
    fieldNames: ['customers', 'location', 'asset']
  },
  {
    key: 'planejamento',
    label: 'Planejamento',
    // Ordem intencional (par a par): Inicio/Vencimento, Duracao/Trabalhador,
    // Adicionais/Equipe - ver secao 10 do pedido de redesign.
    fieldNames: [
      'estimatedStartDate',
      'dueDate',
      'estimatedDuration',
      'primaryUser',
      'assignedTo',
      'team'
    ]
  },
  {
    key: 'anexos',
    label: 'Anexos',
    fieldNames: ['files', 'image']
  }
];

// Campos que ganham midWidth (2 colunas em telas >= lg) SOMENTE dentro deste
// modal - clonados via spread, nunca mutando os objetos de field originais
// (esses mesmos objetos, sem midWidth, sao reusados pelo modal de EDICAO em
// WorkOrders/index.tsx). Title/description/customers/image/files/tasks
// ficam de fora de proposito (largura total).
const MID_WIDTH_FIELD_NAMES = new Set([
  'priority',
  'category',
  'assetStatus',
  'requiredSignature',
  'location',
  'asset',
  'estimatedStartDate',
  'dueDate',
  'estimatedDuration',
  'primaryUser',
  'assignedTo',
  'team'
]);

const AUTO_MANAGED_FIELD_NAMES = ['tasks'];
const allKnownFieldNames = [
  ...TAB_CONFIG.flatMap((tab) => tab.fieldNames),
  ...AUTO_MANAGED_FIELD_NAMES
];
const TAB_HELPERS: Record<string, string> = {
  pedido: 'Defina o problema, prioridade e exigências da ordem.',
  destino: 'Informe cliente, local e equipamento para orientar o atendimento.',
  planejamento: 'Atribua responsáveis, prazo e duração estimada.',
  anexos: 'Adicione imagens e arquivos úteis antes do atendimento.'
};

// Preview do destino, exclusivo da etapa Destino. Endereco/coordenadas, quando
// existem, vem SO de dados ja carregados no Redux (locationsMini/assetsMini,
// que a CustomSelect2 ja busca pro Autocomplete de Localizacao/Ativo) -
// nenhuma chamada nova. Com lat/lng validos, reusa LocationMiniMap
// (WorkOrders/Details/LocationMiniMap.tsx - MESMO componente ja usado no
// painel de detalhes da OS): embed OpenStreetMap, sem chave/API paga, ja
// funcional nesta instalacao (o Map via Google - components/Map - existe no
// projeto mas precisa de GOOGLE_KEY, que esta vazia aqui). Sem coordenadas
// validas, cai no fallback visual CSS (pino decorativo) - nunca quebra o
// fluxo. Sem nenhuma selecao ainda, card compacto de estado vazio.
function DestinationMapPreview({
  summary,
  geo
}: {
  summary: { customer?: any; location?: any; asset?: any } | null;
  geo: LocationMiniDTO | null;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));
  const hasSelection = Boolean(summary);
  const hasCoordinates =
    !!geo && Number.isFinite(geo.latitude) && Number.isFinite(geo.longitude);
  const mapsHref = hasCoordinates
    ? `https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`
    : geo?.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(geo.address)}`
    : null;

  if (!hasSelection) {
    return (
      <Box
        sx={{
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.text.secondary, 0.1)}`,
          backgroundColor: alpha(theme.palette.text.secondary, 0.025),
          p: 1.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 64
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', textAlign: 'center' }}
        >
          {t('wo_add_destination_empty_state')}
        </Typography>
      </Box>
    );
  }

  const title =
    [summary.customer?.label, summary.location?.label, summary.asset?.label]
      .filter(Boolean)
      .join(' · ') || '—';

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${alpha(BRAND.primary, 0.18)}`,
        backgroundColor: alpha(BRAND.primary, 0.05),
        p: 1.25
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1.5}
      >
        <Typography variant="body2" fontWeight={700} noWrap>
          {title}
        </Typography>
        {/* So "Abrir no mapa" aqui - "Ver detalhes" ja existe no proprio
            campo Localizacao (CustomSelect2), repetir seria redundante. */}
        {mapsHref && (
          <Link
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            variant="caption"
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              whiteSpace: 'nowrap'
            }}
          >
            <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
            {t('wo_add_open_in_maps')}
          </Link>
        )}
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.25, mb: 0.75 }}
      >
        {geo?.address || t('wo_add_destination_no_address')}
      </Typography>
      {hasCoordinates ? (
        <LocationMiniMap
          latitude={geo.latitude}
          longitude={geo.longitude}
          height={isLgUp ? 190 : 170}
        />
      ) : (
        // Fallback sem coordenadas validas: pino decorativo em CSS (sem
        // dependencia de mapa real) - mantido de proposito, nunca removido.
        <Box
          sx={{
            position: 'relative',
            height: 64,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: [
              `linear-gradient(135deg, ${alpha(
                BRAND.primary,
                0.14
              )} 0%, ${alpha(theme.palette.info.main, 0.08)} 100%)`,
              `repeating-linear-gradient(60deg, ${alpha(
                theme.palette.common.black,
                0.035
              )} 0px, ${alpha(
                theme.palette.common.black,
                0.035
              )} 1px, transparent 1px, transparent 22px)`
            ].join(', ')
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              backgroundColor: BRAND.primary,
              boxShadow: `0 0 0 5px ${alpha(BRAND.primary, 0.18)}`
            }}
          >
            <PlaceRoundedIcon fontSize="small" />
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default function AddWorkOrderTabbedModal(props: PropsType) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { logo, name: brandName } = useBrand();
  const { open, onClose, fields, validation, values, onSubmit, onChange } =
    props;
  // So leitura - ja vem carregado pelos proprios CustomSelect2 de
  // Localizacao/Ativo (getLocationsMini/getAssetsMini) enquanto o usuario
  // usa a etapa Destino. Nenhum dispatch novo aqui.
  const { locationsMini } = useSelector((state) => state.locations);
  const { assetsMini } = useSelector((state) => state.assets);
  const [activeTab, setActiveTab] = useState(0);
  const isLastTab = activeTab === TAB_CONFIG.length - 1;

  const handleStepClick = (index: number) => {
    setActiveTab(index);
  };

  const handlePreviousTab = () => {
    setActiveTab((prev) => Math.max(prev - 1, 0));
  };

  const handleNextTab = () => {
    setActiveTab((prev) => Math.min(prev + 1, TAB_CONFIG.length - 1));
  };

  const handleFinalSubmit = async (formik: FormikProps<IHash<any>>) => {
    const errors = await formik.validateForm();
    const errorFields = Object.keys(errors);

    if (errorFields.length) {
      formik.setTouched(
        errorFields.reduce((acc, fieldName) => ({ ...acc, [fieldName]: true }), {}),
        false
      );

      const firstErrorField = fields.find((field) =>
        errorFields.includes(field.name)
      )?.name;
      let targetTab = TAB_CONFIG.findIndex((tab) =>
        tab.fieldNames.includes(firstErrorField)
      );
      // Microfix local: campo com erro que nao esta mapeado em nenhuma aba
      // (ex.: campo customizado, que vive em Pedido por exclusao - ver
      // tabFields abaixo) caia em targetTab=-1 e o salto pra aba com erro
      // nao acontecia. Mesma regra de fallback ja usada pra montar as abas.
      if (
        targetTab === -1 &&
        firstErrorField &&
        !allKnownFieldNames.includes(firstErrorField)
      ) {
        targetTab = 0;
      }

      if (targetTab >= 0 && targetTab !== activeTab) {
        setActiveTab(targetTab);
      }
      return;
    }

    await formik.submitForm();
  };

  const tabFields = useMemo(() => {
    const currentTabConfig = TAB_CONFIG[activeTab];
    const matched = fields.filter((f) => {
      if (f.type === 'titleGroupField') return false;
      if (activeTab === 0) {
        return (
          currentTabConfig.fieldNames.includes(f.name) ||
          !allKnownFieldNames.includes(f.name)
        );
      }
      return currentTabConfig.fieldNames.includes(f.name);
    });

    const orderIndex = (name: string) => {
      const idx = currentTabConfig.fieldNames.indexOf(name);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    const ordered = [...matched].sort(
      (a, b) => orderIndex(a.name) - orderIndex(b.name)
    );

    const withWidths = ordered.map((f) => {
      let mapped = f;
      if (MID_WIDTH_FIELD_NAMES.has(f.name)) mapped = { ...mapped, midWidth: true };
      // 2-3 linhas visiveis inicialmente, nao 4 (o textarea continua
      // expansivel pelo proprio usuario) - so apresentacao, mesmo
      // value/payload/validacao/limite de texto.
      if (f.name === 'description') mapped = { ...mapped, rows: 3 };
      // "Requer assinatura" com apresentacao compacta (caixa fina, mesmo
      // ritmo visual dos outros campos) em vez do bloco h6/mb:2 padrao do
      // CustomSwitch - so aqui, via clone; CustomSwitch.tsx nao muda.
      if (f.name === 'requiredSignature')
        mapped = { ...mapped, compact: true };
      // Rotulos mais claros so na apresentacao desta aba - o campo
      // original (usado tambem na Edicao) mantem seu label padrao
      // ("Imagem"/"Arquivos"), sem alteracao.
      if (f.name === 'image')
        mapped = {
          ...mapped,
          label: t('wo_add_image_title'),
          fileVariant: 'light'
        };
      if (f.name === 'files')
        mapped = {
          ...mapped,
          label: t('wo_add_files_title'),
          fileVariant: 'light'
        };
      return mapped;
    });

    // Seção discreta pros campos customizados (so existem em Pedido, por nao
    // estarem em allKnownFieldNames) - tipo titleGroupField ja suportado
    // pelo Form, so inserido aqui, sem tocar em index.tsx.
    if (activeTab === 0) {
      const firstCustomIndex = withWidths.findIndex((f) =>
        f.name.startsWith('customField_')
      );
      if (firstCustomIndex >= 0) {
        withWidths.splice(firstCustomIndex, 0, {
          name: 'customFieldsGroup',
          type: 'titleGroupField',
          label: t('custom_fields')
        });
      }
    }

    return withWidths;
  }, [activeTab, fields, t]);

  // Le o ESTADO AO VIVO do formik (nao os values iniciais estaticos) - so
  // assim o resumo reflete o que o usuario acabou de selecionar. Nenhuma
  // busca/API nova: customers/location/asset ja vem como {label, value}
  // no proprio formik.values (mesmo shape usado pelo CustomSelect2).
  const getDestinationSummary = (formikValues: IHash<any>) => {
    const customer = formikValues?.customers;
    const location = formikValues?.location;
    const asset = formikValues?.asset;
    if (!customer?.label && !location?.label && !asset?.label) return null;
    return { customer, location, asset };
  };

  // Resolve endereco/coordenadas so a partir de dados JA carregados no
  // Redux (locationsMini/assetsMini) - sem chamada de API nova. Localizacao
  // tem prioridade; sem ela, tenta via o locationId do Ativo selecionado.
  // Sem nenhum dos dois, retorna null (estado vazio no card, sem quebrar).
  const getDestinationGeo = (
    formikValues: IHash<any>
  ): LocationMiniDTO | null => {
    const locationId = formikValues?.location?.value;
    const assetId = formikValues?.asset?.value;
    let geo = locationId
      ? locationsMini.find((loc) => loc.id === locationId)
      : null;
    if (!geo && assetId) {
      const relatedAsset = assetsMini.find((a) => a.id === assetId);
      if (relatedAsset?.locationId) {
        geo = locationsMini.find((loc) => loc.id === relatedAsset.locationId);
      }
    }
    return geo ?? null;
  };

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
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          // Calibrado pra parecer um MODAL amplo, nao fullscreen disfarcado:
          // ~1048px em 1366px de viewport, ~1081px em 1440px, ~1297px em
          // 1920px (formula linear ajustada a esses 3 pontos). Abaixo de
          // "sm" continua ocupando quase a tela toda (fica pequeno demais
          // senao).
          width: {
            xs: 'calc(100% - 16px)',
            sm: 'calc(100% - 48px)',
            md: 'clamp(760px, calc(45vw + 433px), 1350px)'
          },
          // Altura acompanha o CONTEUDO da etapa atual (Destino/Anexos
          // ficam curtos, Planejamento cresce um pouco mais) - so um teto
          // maximo, nunca uma altura fixa obrigatoria.
          height: 'auto',
          maxHeight: { xs: '94vh', sm: '90vh' },
          m: { xs: 1, sm: 2 },
          overflow: 'hidden',
          boxShadow: `0 28px 80px ${alpha(theme.palette.common.black, 0.24)}`,
          border: `1px solid ${alpha(BRAND.primary, 0.14)}`,
          // Fina faixa no topo com o navy da marca - toque discreto de
          // identidade (evitei o acento vermelho aqui de proposito: numa
          // faixa isolada no topo do modal poderia ler como estado de
          // erro/alerta).
          borderTop: `3px solid ${BRAND.primary}`,
          backgroundColor: alpha('#F7F9FC', 0.92),
          backdropFilter: 'blur(18px) saturate(150%)'
        }
      }}
      BackdropProps={{
        sx: {
          backgroundColor: alpha('#102a3a', 0.38),
          backdropFilter: 'blur(8px)'
        }
      }}
    >
      <DialogTitle
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 1.75, sm: 2 },
          pb: 1.25,
          borderBottom: `1px solid ${alpha(BRAND.primary, 0.1)}`,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(
            BRAND.primary,
            0.09
          )} 100%)`
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
            {(logo.dark || logo.white) && (
              <Box
                component="img"
                src={logo.dark || logo.white}
                alt={brandName}
                sx={{
                  width: 34,
                  height: 34,
                  objectFit: 'contain',
                  flexShrink: 0,
                  filter: `drop-shadow(0 3px 6px ${alpha(BRAND.primary, 0.2)})`
                }}
              />
            )}
            <Box minWidth={0}>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, lineHeight: 1.2 }}
                noWrap
              >
                {t('add_wo')}
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Configure o atendimento e o planejamento da OS.
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label={t('close')}
            onClick={onClose}
            size="small"
            sx={{
              flex: '0 0 auto',
              color: theme.palette.text.secondary,
              border: `1px solid ${alpha(theme.palette.text.secondary, 0.14)}`,
              backgroundColor: alpha(theme.palette.common.white, 0.78),
              '&:hover': {
                color: theme.palette.text.primary,
                backgroundColor: alpha(theme.palette.common.white, 0.95)
              }
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <Box
        sx={{
          px: { xs: 1.5, sm: 3 },
          pt: 1.25,
          pb: 1,
          borderBottom: `1px solid ${alpha(BRAND.primary, 0.1)}`,
          backgroundColor: theme.palette.background.paper
        }}
      >
        <Stepper
          nonLinear
          activeStep={activeTab}
          sx={{
            '& .MuiStepConnector-line': {
              borderColor: alpha(BRAND.primary, 0.22)
            },
            '& .MuiStepLabel-label': {
              fontWeight: 700,
              fontSize: 13.5
            },
            '& .MuiStepLabel-label.Mui-active': {
              color: BRAND.primary,
              fontWeight: 800
            },
            '& .MuiStepLabel-label.Mui-completed': {
              color: theme.palette.text.primary
            },
            '& .MuiStepIcon-root.Mui-active': {
              color: BRAND.primary
            },
            '& .MuiStepIcon-root.Mui-completed': {
              color: BRAND.primary
            }
          }}
        >
          {TAB_CONFIG.map((tab, index) => (
            <Step key={tab.key} completed={index < activeTab}>
              <StepButton onClick={() => handleStepClick(index)}>
                {tab.label}
              </StepButton>
            </Step>
          ))}
        </Stepper>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.5, pl: 0.5 }}
        >
          {TAB_HELPERS[TAB_CONFIG[activeTab].key]}
        </Typography>
      </Box>
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          // flex:'0 1 auto' (nao flex:1) - de proposito: cresce so o
          // necessario pro conteudo da etapa atual, nunca estica pra
          // preencher o teto de altura (maxHeight). "shrink:1" + minHeight:0
          // continuam garantindo que, quando o conteudo passar do teto, a
          // area role internamente em vez de estourar o modal.
          flex: '0 1 auto',
          minHeight: 0,
          p: { xs: 1.5, sm: 2.5 },
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${alpha('#FFFFFF', 0.52)} 0%, ${alpha(
            '#F4F8F8',
            0.88
          )} 100%)`
        }}
      >
        <Box
          sx={{
            px: { xs: 1.5, sm: 3 },
            pt: { xs: 1.5, sm: 2.25 },
            pb: 0,
            flex: '0 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            borderRadius: 2,
            border: `1px solid ${alpha('#FFFFFF', 0.72)}`,
            backgroundColor: theme.palette.background.paper,
            boxShadow: `0 10px 30px ${alpha(theme.palette.common.black, 0.045)}`,
            '& .MuiGrid-container': {
              alignItems: 'flex-start'
            },
            '& .MuiGrid-item:last-of-type': {
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
              mt: 1,
              mx: { xs: -1.5, sm: -3 },
              px: { xs: 1.5, sm: 3 },
              py: 1.5,
              display: 'flex',
              borderTop: `1px solid ${alpha(BRAND.primary, 0.1)}`,
              backgroundColor: theme.palette.background.paper,
              boxShadow: `0 -8px 20px ${alpha(
                theme.palette.common.black,
                0.05
              )}`
            },
            '& .MuiGrid-item:last-of-type .MuiButton-root': {
              fontWeight: 700,
              boxShadow: 'none',
              borderRadius: 1.5,
              px: 3,
              py: 1.05
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              backgroundColor: '#FFFFFF'
            }
            // (removido: '& textarea': { minHeight: 60 } - CSS residual da
            // primeira tentativa de encolher a descricao. Causava o efeito
            // OPOSTO: o react-textarea-autosize mede um clone-sombra oculto
            // pra calcular a altura por linha, e esse min-height generico
            // (que tambem batia no clone-sombra) inflava a conta pra
            // ~60px "por linha" x minRows=3 = 180px. A altura correta agora
            // vem so de minRows/maxRows no proprio field (Field.tsx).
          }}
        >
          <Form
            fields={tabFields}
            validation={validation}
            values={values}
            onChange={onChange}
            onSubmit={onSubmit}
            renderActions={(formik) => {
              const destinationSummary =
                activeTab === 1 ? getDestinationSummary(formik.values) : null;
              const destinationGeo =
                activeTab === 1 ? getDestinationGeo(formik.values) : null;
              return (
              <Stack sx={{ width: '100%' }} spacing={1.5}>
                {activeTab === 1 && (
                  <DestinationMapPreview
                    summary={destinationSummary}
                    geo={destinationGeo}
                  />
                )}
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Button
                    color="secondary"
                    onClick={onClose}
                    disabled={formik.isSubmitting}
                  >
                    {t('cancel')}
                  </Button>
                  <Stack direction="row" spacing={1.25}>
                    {activeTab > 0 && (
                      <Button
                        variant="outlined"
                        onClick={handlePreviousTab}
                        startIcon={<ChevronLeftRoundedIcon />}
                        disabled={formik.isSubmitting}
                        sx={{
                          color: BRAND.primary,
                          borderColor: alpha(BRAND.primary, 0.5),
                          '&:hover': {
                            borderColor: BRAND.primary,
                            backgroundColor: alpha(BRAND.primary, 0.06)
                          }
                        }}
                      >
                        {t('previous')}
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      onClick={() =>
                        isLastTab ? handleFinalSubmit(formik) : handleNextTab()
                      }
                      endIcon={
                        isLastTab ? null : (
                          <ChevronRightRoundedIcon fontSize="small" />
                        )
                      }
                      disabled={
                        Boolean(formik.errors.submit) || formik.isSubmitting
                      }
                      // Cor real da marca (#2A4899) no lugar do azul generico
                      // do tema MUI (#5569ff) - so aqui, botao especifico
                      // deste modal.
                      sx={{
                        backgroundColor: BRAND.primary,
                        '&:hover': {
                          backgroundColor: darken(BRAND.primary, 0.15)
                        }
                      }}
                    >
                      {t(isLastTab ? 'create_work_order' : 'next')}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
              );
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
