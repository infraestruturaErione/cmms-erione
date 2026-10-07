import { useEffect, useState } from 'react';
import { Box, ButtonBase, Collapse, Stack, Typography } from '@mui/material';
import ExpandMoreTwoToneIcon from '@mui/icons-material/ExpandMoreTwoTone';
import { useTranslation } from 'react-i18next';
import Comment from '../../../../models/owns/comment';
import CommentsSection from './CommentsSection';
import { isFieldReportComment } from './fieldReportUtils';

export default function CommentsDisclosure({
  workOrderId,
  comments,
  commentId
}: {
  workOrderId: number;
  comments: Comment[];
  commentId?: number;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!!commentId);
  const count = comments.filter(
    (comment) => !isFieldReportComment(comment)
  ).length;
  const panelId = `work-order-${workOrderId}-comments`;

  useEffect(() => {
    setExpanded(!!commentId);
  }, [workOrderId, commentId]);

  return (
    <Box
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, minWidth: 0 }}
    >
      <ButtonBase
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
        sx={{
          width: '100%',
          p: 2,
          justifyContent: 'space-between',
          textAlign: 'left',
          borderRadius: 1.5,
          gap: 1,
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': {
            outline: '2px solid',
            outlineColor: 'primary.main'
          }
        }}
      >
        <Stack sx={{ gap: 0.5, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {`${t('comments')} (${count})`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('report_admin_comments_helper')}
          </Typography>
        </Stack>
        <ExpandMoreTwoToneIcon
          sx={{
            flexShrink: 0,
            color: 'text.secondary',
            transform: expanded ? 'rotate(180deg)' : 'none'
          }}
        />
      </ButtonBase>
      {/* Keep the existing composer mounted so collapsing never loses a draft. */}
      <Collapse in={expanded} mountOnEnter={false} unmountOnExit={false}>
        <Box id={panelId} sx={{ borderTop: 1, borderColor: 'divider' }}>
          <CommentsSection workOrderId={workOrderId} commentId={commentId} />
        </Box>
      </Collapse>
    </Box>
  );
}
