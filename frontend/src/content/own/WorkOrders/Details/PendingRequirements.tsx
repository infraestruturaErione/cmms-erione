import { Box, Card, CardContent, CardHeader, Stack, Typography, useTheme } from '@mui/material';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import RadioButtonUncheckedTwoToneIcon from '@mui/icons-material/RadioButtonUncheckedTwoTone';
import FactCheckTwoToneIcon from '@mui/icons-material/FactCheckTwoTone';
import { useTranslation } from 'react-i18next';
import WorkOrder from '../../../../models/owns/workOrder';
import { Task } from '../../../../models/owns/tasks';
import Comment from '../../../../models/owns/comment';
import { hasFieldEvidence } from './fieldReportUtils';
import { isExecutionTaskComplete } from '../../../../utils/tasks';

interface PendingRequirementsProps {
  workOrder: WorkOrder;
  fieldReportText: string;
  tasks: Task[];
  comments: Comment[];
}

interface Requirement {
  key: string;
  labelKey: string;
  done: boolean;
}

// Card "Pendencias" - so lista as obrigatoriedades que o Tipo de Tarefa
// (Categoria da OS) realmente marcou, checando contra o que ja foi
// preenchido na OS. Categoria sem nenhuma obrigatoriedade -> card nao
// renderiza nada (retorna null no componente pai).
export const getPendingRequirements = (
  workOrder: WorkOrder,
  fieldReportText: string,
  tasks: Task[],
  comments: Comment[]
): Requirement[] => {
  const category = workOrder.category;
  if (!category) return [];

  const requirements: Requirement[] = [];
  if (category.requireSignature) {
    requirements.push({
      key: 'signature',
      labelKey: 'signature',
      done: !!workOrder.signature
    });
  }
  if (category.requireSignerName) {
    requirements.push({
      key: 'signerName',
      labelKey: 'signer_name',
      done: !!workOrder.signerName
    });
  }
  if (category.requireSignerDocument) {
    requirements.push({
      key: 'signerDocument',
      labelKey: 'signer_document',
      done: !!workOrder.signerDocument
    });
  }
  if (category.requirePhotos) {
    requirements.push({
      key: 'photos',
      labelKey: 'photos',
      done: hasFieldEvidence(comments)
    });
  }
  if (category.requireFieldReport) {
    requirements.push({
      key: 'fieldReport',
      labelKey: 'field_report',
      done: !!fieldReportText
    });
  }
  if (category.requireMileage) {
    requirements.push({
      key: 'mileage',
      labelKey: 'mileage_traveled',
      done: !!workOrder.mileageTraveled
    });
  }
  if (category.requireChecklistCompletion) {
    requirements.push({
      key: 'checklist',
      labelKey: 'service_checklist',
      done: !!tasks.length && tasks.every(isExecutionTaskComplete)
    });
  }
  return requirements;
};

export default function PendingRequirements({
  workOrder,
  fieldReportText,
  tasks,
  comments
}: PendingRequirementsProps) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const requirements = getPendingRequirements(
    workOrder,
    fieldReportText,
    tasks,
    comments
  );

  if (!requirements.length) return null;

  const doneCount = requirements.filter((r) => r.done).length;

  return (
    <Card>
      <CardHeader
        avatar={<FactCheckTwoToneIcon />}
        title={t('pending_requirements')}
        subheader={t('pending_requirements_count', {
          done: doneCount,
          total: requirements.length
        })}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={1}>
          {requirements.map((requirement) => (
            <Box
              key={requirement.key}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: requirement.done
                  ? theme.colors.success.lighter
                  : theme.colors.alpha.black[5]
              }}
            >
              {requirement.done ? (
                <CheckCircleTwoToneIcon color="success" fontSize="small" />
              ) : (
                <RadioButtonUncheckedTwoToneIcon
                  color="disabled"
                  fontSize="small"
                />
              )}
              <Typography
                variant="body2"
                fontWeight={600}
                color={requirement.done ? 'text.primary' : 'text.secondary'}
              >
                {t(requirement.labelKey)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
