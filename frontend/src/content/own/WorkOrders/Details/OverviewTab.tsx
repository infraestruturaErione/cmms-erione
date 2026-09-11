import React from 'react';
import { Box, Chip, Divider, Grid, Link, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import WorkOrder from '../../../../models/owns/workOrder';
import { Task } from '../../../../models/owns/tasks';
import Comment from '../../../../models/owns/comment';
import LocationMiniMap from './LocationMiniMap';
import { getPendingRequirements } from './PendingRequirements';
import FieldExecutionTimeline from './FieldExecutionTimeline';
import AssignmentLateTwoToneIcon from '@mui/icons-material/AssignmentLateTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import PersonOutlineTwoToneIcon from '@mui/icons-material/PersonOutlineTwoTone';
import RadioButtonCheckedTwoToneIcon from '@mui/icons-material/RadioButtonCheckedTwoTone';
import { getAssetUrl, getPreventiveMaintenanceUrl, getUserUrl } from '../../../../utils/urlPaths';
import { getCustomFieldValuesForDetails } from '../../type';
import {
  getLocationAddressWithReference,
  getLocationIdentification
} from '../../../../utils/locationDisplay';

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

// Contexto operacional antes da descricao e dos metadados administrativos.
// Acoes continuam no header; pendencias e timeline reutilizam as regras atuais.
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
      <Grid item xs={12} sm={6} md={6}>
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
    {
      label: t('wo_overview_code_label', 'Código da OS'),
      value: workOrder.customId
    },
    { label: t('category'), value: workOrder.category?.name },
    {
      label: t('asset'),
      value: workOrder.asset?.name,
      type: workOrder.asset ? 'asset' : undefined,
      id: workOrder.asset?.id
    },
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

  const pendingRequirements = getPendingRequirements(
    workOrder,
    fieldReportText,
    tasks,
    comments
  );
  const incompleteRequirements = pendingRequirements.filter(
    (requirement) => !requirement.done
  );
  const pendingLabel = incompleteRequirements.length
    ? incompleteRequirements
        .slice(0, 2)
        .map((requirement) => t(requirement.labelKey))
        .join(' · ') +
      (incompleteRequirements.length > 2
        ? ` +${incompleteRequirements.length - 2}`
        : '')
    : t('none', 'Nenhuma');
  const summaryItems = [
    {
      label: t('primary_worker'),
      value: technicianLabel || '—',
      icon: <PersonOutlineTwoToneIcon fontSize="small" color="primary" />
    },
    {
      label: t('location'),
      value: workOrder.location
        ? getLocationIdentification(workOrder.location)
        : '—',
      icon: <LocationOnTwoToneIcon fontSize="small" color="primary" />
    },
    {
      label: t('status'),
      value: workOrder.status ? t(workOrder.status) : '—',
      icon: <RadioButtonCheckedTwoToneIcon fontSize="small" color="primary" />
    },
    {
      label: incompleteRequirements.length > 1
        ? t('pending_requirements')
        : t('pending_requirement', 'Pendência'),
      value: pendingLabel,
      icon: (
        <AssignmentLateTwoToneIcon
          fontSize="small"
          color={incompleteRequirements.length ? 'warning' : 'success'}
        />
      )
    }
  ];

  return (
    <Box>
      <Box
        sx={{
          mb: 2,
          px: { xs: 1.25, sm: 1.75 },
          py: 1.25,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          bgcolor: 'action.hover'
        }}
      >
        <Grid container spacing={1.5}>
          {summaryItems.map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.label}>
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <Box sx={{ display: 'flex', mt: 0.15 }}>{item.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.label}
                  </Typography>
                  {item === summaryItems[3] ? (
                    <Chip
                      size="small"
                      label={item.value}
                      color={incompleteRequirements.length ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  ) : (
                    <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                      {item.value}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>
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
                  {t('wo_overview_address_label', 'Endereço')}
                </Typography>
                <Link
                  display="block"
                  variant="body2"
                  fontWeight={600}
                  href={getPath('location', workOrder.location.id)}
                >
                  {getLocationIdentification(workOrder.location)}
                </Link>
                {getLocationAddressWithReference(workOrder.location) && (
                  <Typography variant="body2" color="text.secondary">
                    {getLocationAddressWithReference(workOrder.location)}
                  </Typography>
                )}
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
              {assignedToLabel && (
                <Grid item xs={12} sm={6} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    {t('assigned_to')}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {assignedToLabel}
                  </Typography>
                </Grid>
              )}
            </Grid>
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
