import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ChangeEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Form from '../../components/form';
import { IField, IHash } from '../../type';
import { ObjectSchema } from 'yup';

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
    fieldNames: [
      'dueDate',
      'estimatedStartDate',
      'estimatedDuration',
      'primaryUser',
      'assignedTo',
      'team'
    ]
  },
  {
    key: 'checklist',
    label: 'Checklist',
    fieldNames: ['tasks']
  },
  {
    key: 'anexos',
    label: 'Anexos',
    fieldNames: ['files', 'image']
  }
];

const allKnownFieldNames = TAB_CONFIG.flatMap((tab) => tab.fieldNames);
const TAB_HELPERS: Record<string, string> = {
  pedido: 'Defina o problema, prioridade e exigências da ordem.',
  destino: 'Informe cliente, local e equipamento para orientar o atendimento.',
  planejamento: 'Atribua responsáveis, prazo e duração estimada.',
  checklist: 'Inclua tarefas para padronizar a execução em campo.',
  anexos: 'Adicione imagens e arquivos úteis antes do atendimento.'
};

export default function AddWorkOrderTabbedModal(props: PropsType) {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    open,
    onClose,
    fields,
    validation,
    values,
    onSubmit,
    onChange,
    submitText
  } = props;
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: ChangeEvent<{}>, newValue: number) => {
    setActiveTab(newValue);
  };

  const tabFields = useMemo(
    () =>
      fields.filter((f) => {
        if (f.type === 'titleGroupField') return false;
        if (activeTab === 0) {
          return (
            TAB_CONFIG[0].fieldNames.includes(f.name) ||
            !allKnownFieldNames.includes(f.name)
          );
        }
        return TAB_CONFIG[activeTab].fieldNames.includes(f.name);
      }),
    [activeTab, fields]
  );

  return (
    <Dialog
      fullWidth
      maxWidth="lg"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 3,
          display: 'flex',
          width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 64px)' },
          height: { xs: '92vh', md: '84vh' },
          maxHeight: { xs: '92vh', md: '84vh' },
          overflow: 'hidden',
          boxShadow: `0 28px 80px ${alpha(theme.palette.common.black, 0.24)}`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
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
          px: { xs: 2.25, sm: 3.5 },
          pt: { xs: 2.25, sm: 2.75 },
          pb: { xs: 1.75, sm: 2 },
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(
            theme.palette.primary.main,
            0.075
          )} 100%)`
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Typography variant="overline" color="primary" fontWeight={800}>
              Work Orders
            </Typography>
            <Typography variant="h3" sx={{ mb: 0.5, fontWeight: 800 }}>
              {t('add_wo')}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary, maxWidth: 720 }}
            >
              Crie uma OS clara para o administrativo e simples de executar no
              app do técnico.
            </Typography>
          </Box>
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              backgroundColor: alpha(theme.palette.primary.main, 0.07)
            }}
          >
            <Typography variant="caption" color="primary" fontWeight={800}>
              Etapa {activeTab + 1} de {TAB_CONFIG.length}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <Box
        sx={{
          px: { xs: 1.25, sm: 3.5 },
          py: 1,
          borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
          backgroundColor: theme.palette.background.paper
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': {
              display: 'none'
            },
            '& .MuiTab-root': {
              minHeight: 40,
              mx: 0.35,
              px: { xs: 1.25, sm: 1.75 },
              borderRadius: 1.5,
              border: `1px solid transparent`,
              color: theme.palette.text.secondary,
              fontWeight: 600,
              opacity: 1,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              transition: theme.transitions.create([
                'color',
                'background-color'
              ]),
              '& .MuiTab-wrapper, & .MuiTypography-root, & span': {
                color: 'inherit'
              },
              '&:hover': {
                color: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.055)
              }
            },
            '& .MuiTab-root.Mui-selected': {
              color: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              borderColor: alpha(theme.palette.primary.main, 0.24),
              opacity: 1,
              '&:hover': {
                color: theme.palette.primary.dark,
                backgroundColor: alpha(theme.palette.primary.main, 0.14)
              }
            }
          }}
        >
          {TAB_CONFIG.map((tab) => (
            <Tab key={tab.key} label={tab.label} />
          ))}
        </Tabs>
      </Box>
      <DialogContent
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' },
          gap: 2,
          flex: 1,
          minHeight: 0,
          p: { xs: 1.25, sm: 2 },
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${alpha('#FFFFFF', 0.52)} 0%, ${alpha(
            '#F4F8F8',
            0.88
          )} 100%)`
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            borderRadius: 2,
            border: `1px solid ${alpha('#FFFFFF', 0.66)}`,
            backgroundColor: theme.palette.background.paper,
            p: 1.75,
            minHeight: 0,
            overflowY: 'auto'
          }}
        >
          <Typography variant="overline" color="text.secondary" fontWeight={800}>
            Fluxo guiado
          </Typography>
          <Stack spacing={1} mt={1}>
            {TAB_CONFIG.map((tab, index) => {
              const selected = index === activeTab;

              return (
                <Box
                  key={tab.key}
                  sx={{
                    p: 1.2,
                    borderRadius: 1.5,
                    border: `1px solid ${
                      selected
                        ? alpha(theme.palette.primary.main, 0.28)
                        : alpha(theme.palette.text.secondary, 0.1)
                    }`,
                    backgroundColor: selected
                      ? alpha(theme.palette.primary.main, 0.08)
                      : theme.palette.grey[50]
                  }}
                >
                  <Stack direction="row" spacing={1.1} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        flex: '0 0 auto',
                        color: selected
                          ? theme.palette.primary.contrastText
                          : theme.palette.text.secondary,
                        backgroundColor: selected
                          ? theme.palette.primary.main
                          : alpha(theme.palette.text.secondary, 0.08),
                        fontSize: 12,
                        fontWeight: 800
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Box minWidth={0}>
                      <Typography fontWeight={800} color="text.primary">
                        {tab.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ lineHeight: 1.45 }}
                      >
                        {TAB_HELPERS[tab.key]}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            pt: { xs: 1.5, sm: 2.5 },
            pb: 0,
            flex: 1,
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
              mx: { xs: -1.5, sm: -2.5 },
              px: { xs: 1.5, sm: 2.5 },
              py: 1.75,
              display: 'flex',
              justifyContent: 'flex-end',
              borderTop: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
              backgroundColor: theme.palette.background.paper,
              boxShadow: `0 -8px 20px ${alpha(
                theme.palette.common.black,
                0.05
              )}`
            },
            '& .MuiGrid-item:last-of-type .MuiButton-root': {
              minWidth: 120,
              fontWeight: 700,
              boxShadow: 'none',
              borderRadius: 1.5,
              px: 3,
              py: 1.05
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              backgroundColor: '#FFFFFF'
            },
            '& textarea': {
              minHeight: 86
            }
          }}
        >
          <Form
            fields={tabFields}
            validation={validation}
            submitText={submitText}
            values={values}
            onChange={onChange}
            onSubmit={onSubmit}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
