import File from '../../../models/owns/file';
import {
  alpha,
  Box,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import DoDisturbOnTwoToneIcon from '@mui/icons-material/DoDisturbOnTwoTone';
import { useContext } from 'react';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import ImageTwoToneIcon from '@mui/icons-material/ImageTwoTone';
import InsertDriveFileTwoToneIcon from '@mui/icons-material/InsertDriveFileTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import mime from 'mime';
import { useTranslation } from 'react-i18next';

interface FilesListProps {
  files: File[];
  onRemove: (id: number) => void;
  confirmMessage: string;
  removeDisabled: boolean;
}
export default function FilesList({
  files,
  onRemove,
  confirmMessage,
  removeDisabled
}: FilesListProps) {
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const isImage = (file: File) =>
    file.type === 'IMAGE' || mime.getType(file.name)?.startsWith('image/');

  return (
    <List
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5
      }}
    >
      {files.map((file) => (
        <ListItem
          key={file.id}
          sx={{
            alignItems: 'stretch',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            pr: removeDisabled ? 1.5 : 7
          }}
          secondaryAction={
            removeDisabled ? null : (
              <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => {
                  if (window.confirm(confirmMessage)) {
                    onRemove(file.id);
                  }
                }}
              >
                <DoDisturbOnTwoToneIcon color="error" />
              </IconButton>
            )
          }
        >
          <Stack direction="row" spacing={1.5} minWidth={0} width="100%">
            <Box
              component={Link}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                width: 88,
                height: 88,
                flexShrink: 0,
                borderRadius: 1,
                border: `1px solid ${theme.palette.divider}`,
                overflow: 'hidden',
                bgcolor: 'background.default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isImage(file) && file.url ? (
                <Box
                  component="img"
                  src={file.url}
                  alt={file.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : isImage(file) ? (
                <ImageTwoToneIcon color="primary" />
              ) : (
                <InsertDriveFileTwoToneIcon color="primary" />
              )}
            </Box>
            <ListItemText
              primary={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {isImage(file) ? (
                    <ImageTwoToneIcon color="primary" fontSize="small" />
                  ) : (
                    <InsertDriveFileTwoToneIcon
                      color="primary"
                      fontSize="small"
                    />
                  )}
                  <Link
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="h6"
                    title={file.name}
                    sx={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {file.name}
                  </Link>
                </Stack>
              }
              secondary={
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {getFormattedDate(file.createdAt)}
                  </Typography>
                  {file.url && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      mt={0.5}
                    >
                      <OpenInNewTwoToneIcon color="primary" fontSize="small" />
                      <Link
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body2"
                      >
                        {t('open')}
                      </Link>
                    </Stack>
                  )}
                </Box>
              }
            />
          </Stack>
        </ListItem>
      ))}
    </List>
  );
}
