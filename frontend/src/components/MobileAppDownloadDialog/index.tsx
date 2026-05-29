import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  Box
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

interface MobileAppDownloadDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileAppDownloadDialog({
  open,
  onClose
}: MobileAppDownloadDialogProps) {
  const { t }: { t: any } = useTranslation();

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('Download Mobile App')}
        </Typography>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          p: 3
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body1">
            {t(
              'Enhance your experience with our mobile app. Get instant notifications and manage your work orders on the go.'
            )}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              mt: 2,
              alignItems: 'center'
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('mobile_app_unavailable_description')}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
