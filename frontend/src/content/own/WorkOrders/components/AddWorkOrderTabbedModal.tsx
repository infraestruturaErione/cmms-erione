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
    label: 'Local e C\u00e2mera',
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
  const { open, onClose, fields, validation, values, onSubmit, onChange, submitText } = props;
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
      maxWidth="md"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: 1,
          overflow: 'hidden',
          boxShadow: theme.shadows[12]
        }
      }}
    >
      <DialogTitle
        sx={{
          px: { xs: 2.5, sm: 3 },
          pt: { xs: 2.5, sm: 3 },
          pb: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper
        }}
      >
        <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 700 }}>
          {t('add_wo')}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary, maxWidth: 620 }}
        >
          {t('add_wo_description')}
        </Typography>
      </DialogTitle>
      <Box
        sx={{
          px: { xs: 1.5, sm: 3 },
          borderBottom: `1px solid ${theme.palette.divider}`,
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
            minHeight: 52,
            '& .MuiTabs-indicator': {
              height: 3,
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3
            },
            '& .MuiTab-root': {
              minHeight: 52,
              px: { xs: 1.25, sm: 2 },
              borderRadius: 0.75,
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
                color: theme.palette.text.primary,
                backgroundColor: alpha(theme.palette.text.primary, 0.035)
              }
            },
            '& .MuiTab-root.Mui-selected': {
              color: theme.palette.primary.contrastText,
              backgroundColor: theme.palette.primary.main,
              opacity: 1,
              '&:hover': {
                color: theme.palette.primary.contrastText,
                backgroundColor: theme.palette.primary.dark
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
          p: 0,
          backgroundColor: theme.palette.background.paper
        }}
      >
        <Box
          sx={{
            px: { xs: 2.5, sm: 3 },
            pt: { xs: 2.5, sm: 3 },
            pb: 0,
            maxHeight: { xs: 'calc(100vh - 220px)', sm: 'calc(100vh - 250px)' },
            overflowY: 'auto',
            '& .MuiGrid-container': {
              alignItems: 'flex-start'
            },
            '& .MuiGrid-item:last-of-type': {
              mt: 1,
              mx: { xs: -2.5, sm: -3 },
              px: { xs: 2.5, sm: 3 },
              py: 2,
              display: 'flex',
              justifyContent: 'flex-end',
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              backgroundColor: theme.palette.background.paper
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
