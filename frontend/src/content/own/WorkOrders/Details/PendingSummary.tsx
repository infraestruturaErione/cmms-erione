import { useTranslation } from 'react-i18next';
import WorkOrder from '../../../../models/owns/workOrder';
import { Task } from '../../../../models/owns/tasks';
import Comment from '../../../../models/owns/comment';
import PendingRequirements, { getPendingRequirements } from './PendingRequirements';
import CompactChecklist from './CompactChecklist';

interface PendingSummaryProps {
  workOrder: WorkOrder;
  fieldReportText: string;
  tasks: Task[];
  comments: Comment[];
}

// Resumo hierarquizado das pendencias de conclusao (categoria) para a aba
// Visao Geral - reusa getPendingRequirements/PendingRequirements sem duplicar
// a logica de calculo, so muda a apresentacao (faixa de chips escaneavel).
export default function PendingSummary({
  workOrder,
  fieldReportText,
  tasks,
  comments
}: PendingSummaryProps) {
  const { t }: { t: any } = useTranslation();
  const requirements = getPendingRequirements(
    workOrder,
    fieldReportText,
    tasks,
    comments
  );

  if (!requirements.length) return null;

  return (
    <CompactChecklist
      items={requirements.map((requirement) => ({
        key: requirement.key,
        label: t(requirement.labelKey),
        done: requirement.done
      }))}
      details={
        <PendingRequirements
          workOrder={workOrder}
          fieldReportText={fieldReportText}
          tasks={tasks}
          comments={comments}
        />
      }
    />
  );
}
