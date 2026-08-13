import { Box, Divider, Grid, Link, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import WorkOrder from '../../../../models/owns/workOrder';
import { Task } from '../../../../models/owns/tasks';
import Comment from '../../../../models/owns/comment';
import LocationMiniMap from './LocationMiniMap';
import PendingSummary from './PendingSummary';
import { getPendingRequirements } from './PendingRequirements';
import FieldExecutionTimeline from './FieldExecutionTimeline';
import { getAssetUrl, getPreventiveMaintenanceUrl, getUserUrl } from '../../../../utils/urlPaths';
import { getCustomFieldValuesForDetails } from '../../type';

interface OverviewTabProps {
  workOrder: WorkOrder;
  getFormattedDate: (date: any) => string;
  getUserNameById: (id: number) => string;
  fieldReportText: string;
  tasks: Task[];
  comments: Comment[];
}

interface FieldDef {
  label: string;
  value: string | number | null | undefined;
  type?: 'location' | 'asset' | 'team' | 'user' | 'pm';
  id?: number;
}

// Aba "Visao Geral" - contexto da OS (quem/onde/quando/o que falta), sem as
// acoes rapidas (que ficam no header persistente) nem os dados de execucao
// (timer/tempo/pecas - ver aba Execucao). Layout em duas areas (esquerda:
// cliente/local/mapa, direita: metadados) inspirado na densidade do Auvo -
// mesmos dados/props do WorkOrderDetails, so reorganizados.
export default function OverviewTab({
  workOrder,
  getFormattedDate,
  getUserNameById,
  fieldReportText,
  tasks,
  comments
}: OverviewTabProps) {
  const { t }: { t: any } = useTranslation();

  const getPath = (resource: string, id: number) => {
    switch (resource) {
      case 'asset':
        return getAssetUrl(id);
      case 'team':
        return `/app/people-teams/teams/${id}`;
      case 'user':
        return getUserUrl(id);
      case 'pm':
        return getPreventiveMaintenanceUrl(id);
      default:
        return `/app/${resource}s/${id}`;
    }
  };

  const Field = ({ label, value, type, id }: FieldDef) => {
    if (!value) return null;
    return (
      <Grid item xs={12} sm={6} md={4}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {type ? (
          <Link
            display="block"
            variant="body2"
            fontWeight={600}
            href={getPath(type, id)}
          >
            {value}
          </Link>
        ) : (
          <Typography variant="body2" fontWeight={600}>
            {value}
          </Typography>
        )}
      </Grid>
    );
  };

  const technicianLabel = [
    workOrder.primaryUser
      ? getUserNameById(workOrder.primaryUser.id)
      : null,
    workOrder.team?.name
  ]
    .filter(Boolean)
    .join(' · ');

  const assignedToLabel = workOrder.assignedTo
    .map((assignee) => `${assignee.firstName} ${assignee.lastName}`)
    .join(', ');

  const fields: FieldDef[] = [
    { label: t('id'), value: workOrder.customId },
    { label: t('category'), value: workOrder.category?.name },
    {
      label: t('asset'),
      value: workOrder.asset?.name,
      type: workOrder.asset ? 'asset' : undefined,
      id: workOrder.asset?.id
    },
    { label: t('primary_worker'), value: technicianLabel },
    { label: t('assigned_to'), value: assignedToLabel },
    { label: t('due_date'), value: getFormattedDate(workOrder.dueDate) },
    {
      label: t('estimated_start_date'),
      value: getFormattedDate(workOrder.estimatedStartDate)
    },
    {
      label: t('estimated_duration'),
      value: workOrder.estimatedDuration
        ? t('estimated_hours_in_text', { hours: workOrder.estimatedDuration })
        : null
    },
    { label: t('created_at'), value: getFormattedDate(workOrder.createdAt) },
    {
      label: workOrder.parentRequest ? t('approved_by') : t('created_by'),
      value:
        workOrder.parentRequest || workOrder.createdBy
          ? getUserNameById(workOrder.createdBy)
          : null,
      type: workOrder.createdBy ? 'user' : undefined,
      id: workOrder.createdBy
    },
    {
      label: t('requested_by'),
      value: workOrder.parentRequest
        ? getUserNameById(workOrder.parentRequest.createdBy)
        : null,
      type: workOrder.parentRequest ? 'user' : undefined,
      id: workOrder.parentRequest?.createdBy
    },
    {
      label: t('preventive_maintenance'),
      value: workOrder.parentPreventiveMaintenance?.name,
      type: workOrder.parentPreventiveMaintenance ? 'pm' : undefined,
      id: workOrder.parentPreventiveMaintenance?.id
    },
    ...(workOrder.status === 'COMPLETE'
      ? [
          {
            label: t('completed_by'),
            value: workOrder.completedBy
              ? `${workOrder.completedBy.firstName} ${workOrder.completedBy.lastName}`
              : null,
            type: workOrder.completedBy ? 'user' : undefined,
            id: workOrder.completedBy?.id
          },
          { label: t('completed_on'), value: getFormattedDate(workOrder.completedOn) },
          { label: t('feedback'), value: workOrder.feedback }
        ]
      : []),
    ...getCustomFieldValuesForDetails(workOrder.customFieldValues, getFormattedDate)
  ].filter(Boolean) as FieldDef[];

  const hasPendingRequirements = !!getPendingRequirements(
    workOrder,
    fieldReportText,
    tasks,
    comments
  ).length;

  return (
    <Box>
      {hasPendingRequirements && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            {t('pending_requirements')}
          </Typography>
          <Box sx={{ mt: 0.25 }}>
            <PendingSummary
              workOrder={workOrder}
              fieldReportText={fieldReportText}
              tasks={tasks}
              comments={comments}
            />
          </Box>
        </Box>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Stack spacing={1.5}>
            {!!workOrder.customers.length && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('customers')}
                </Typography>
                <Stack spacing={0.25}>
                  {workOrder.customers.map((customer) => (
                    <Link
                      key={customer.id}
                      href={`/app/vendors-customers/customers/${customer.id}`}
                      variant="body2"
                      fontWeight={600}
                    >
                      {customer.name}
                    </Link>
                  ))}
                </Stack>
              </Box>
            )}
            {workOrder.location && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('location')}
                </Typography>
                <Link
                  display="block"
                  variant="body2"
                  fontWeight={600}
                  href={getPath('location', workOrder.location.id)}
                >
                  {workOrder.location.name}
                </Link>
              </Box>
            )}
            {!!workOrder.location?.latitude && !!workOrder.location?.longitude && (
              <LocationMiniMap
                latitude={workOrder.location.latitude}
                longitude={workOrder.location.longitude}
                height={160}
              />
            )}
          </Stack>
        </Grid>

        <Grid item xs={12} md={7}>
          <Stack spacing={1.5}>
            {workOrder.description && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('description')}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {workOrder.description}
                </Typography>
              </Box>
            )}
            <Grid container spacing={1.5} rowSpacing={1.25}>
              {fields.map((field, index) => (
                <Field key={index} {...field} />
              ))}
            </Grid>
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />
      <Typography variant="overline" color="text.secondary">
        {t('execution_tab')}
      </Typography>
      <Box sx={{ mt: 1 }}>
        <FieldExecutionTimeline workOrder={workOrder} getFormattedDate={getFormattedDate} />
      </Box>
    </Box>
  );
}
