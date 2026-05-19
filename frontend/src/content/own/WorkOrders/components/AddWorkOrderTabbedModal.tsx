import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  Typography
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ChangeEvent, useState } from 'react';
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
    key: 'geral',
    label: 'Geral',
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
    key: 'local',
    label: 'Local e Equipamento',
    fieldNames: ['location', 'asset']
  },
  {
    key: 'equipe',
    label: 'Equipe e Agenda',
    fieldNames: [
      'dueDate',
      'estimatedStartDate',
      'estimatedDuration',
      'primaryUser',
      'assignedTo',
      'customers',
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

  const tabFields = fields.filter((f) => {
    if (f.type === 'titleGroupField') return false;
    if (activeTab === 0) {
      return (
        TAB_CONFIG[0].fieldNames.includes(f.name) ||
        !allKnownFieldNames.includes(f.name)
      );
    }
    return TAB_CONFIG[activeTab].fieldNames.includes(f.name);
  });

  return (
    <Dialog
      fullWidth
      maxWidth="lg"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          display: 'flex',
          height: { xs: '94vh', sm: '88vh' },
          maxHeight: { xs: '94vh', sm: '88vh' },
          overflow: 'hidden',
          boxShadow: `0 24px 70px ${alpha(theme.palette.common.black, 0.22)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          backgroundColor: theme.palette.grey[50]
        }
      }}
    >
      <DialogTitle
        sx={{
          px: { xs: 2.5, sm: 3.5 },
          pt: { xs: 2.5, sm: 3 },
          pb: 2.25,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(
            theme.palette.primary.main,
            0.055
          )} 100%)`
        }}
      >
        <Typography variant="h3" sx={{ mb: 0.5, fontWeight: 800 }}>
          {t('add_wo')}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary, maxWidth: 720 }}
        >
          {t('add_wo_description')}
        </Typography>
      </DialogTitle>
      <Box
        sx={{
          px: { xs: 1.5, sm: 3.5 },
          py: 1.25,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.92),
          backdropFilter: 'blur(10px)'
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
          display: 'flex',
          flex: 1,
          minHeight: 0,
          p: { xs: 1.5, sm: 2.5 },
          overflow: 'hidden',
          backgroundColor: theme.palette.grey[50]
        }}
      >
        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            pt: { xs: 1.5, sm: 2.5 },
            pb: 0,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
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
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              backgroundColor: alpha(theme.palette.background.paper, 0.94),
              boxShadow: `0 -8px 20px ${alpha(
                theme.palette.common.black,
                0.05
              )}`,
              backdropFilter: 'blur(10px)'
            },
            '& .MuiGrid-item:last-of-type .MuiButton-root': {
              minWidth: 120,
              fontWeight: 700,
              boxShadow: 'none'
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
