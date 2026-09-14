import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import CloseTwoToneIcon from '@mui/icons-material/CloseTwoTone';
import UserRoleCardList from './UserRoleCardList';
import { EmailOutlined } from '@mui/icons-material';
import { inviteUsers } from '../../../../slices/user';
import * as React from 'react';
import { useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { emailRegExp } from '../../../../utils/validators';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../../store';
import { isEmailVerificationEnabled } from '../../../../config';
import CreateUser from './CreateUser';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      fontWeight={700}
      sx={{ display: 'block', mb: 1, letterSpacing: 0.2 }}
    >
      {children}
    </Typography>
  );
}

export default function InviteUserDialog({
  open,
  onClose,
  onRefreshUsers,
  initialEmail
}: {
  open: boolean;
  onClose: () => void;
  onRefreshUsers: () => void;
  initialEmail?: string;
}) {
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [roleId, setRoleId] = useState<number>();
  const { t } = useTranslation();
  const [emails, setEmails] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [currentEmail, setCurrentEmail] = useState<string>(initialEmail);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { users, loadingGet, singleUser } = useSelector((state) => state.users);
  const dispatch = useDispatch();

  const onRoleChange = (id: number) => {
    setRoleId(id);
  };
  const verifyCurrentEmail = (): boolean => {
    if (currentEmail) {
      let error;
      if (emails.length < 20) {
        const emailsClone = [...emails];
        if (emailsClone.includes(currentEmail)) {
          error = 'This email is already selected';
        } else {
          if (users.content.map((user) => user.email).includes(currentEmail)) {
            error = 'A user with this email is already in this company';
          } else {
            if (!currentEmail.match(emailRegExp)) {
              error = 'This email is invalid';
            }
          }
        }
      } else error = 'You can invite a maximum of 20 users at once';
      if (error) {
        showSnackBar(t(error), 'error');
        setIsInviteSubmitting(false);
        return false;
      }
    }
    return true;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 720, maxWidth: '94vw', borderRadius: 2 } }}
    >
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4">{t('invite_users')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t(
                'invite_users_dialog_subtitle',
                'Escolha o acesso e informe os dados do usuário.'
              )}
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={onClose}
            size="small"
            sx={{ mt: -0.5, mr: -0.5 }}
          >
            <CloseTwoToneIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 3,
          pt: 0,
          pb: 3
        }}
      >
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>{t('access', 'Acesso')}</SectionLabel>
          <UserRoleCardList onChange={onRoleChange} />
        </Box>

        <Box>
          <SectionLabel>{t('user_data', 'Dados do usuário')}</SectionLabel>

          {isEmailVerificationEnabled ? (
            <>
              {!!emails.length && (
                <Grid container spacing={1} sx={{ mb: 1.5 }}>
                  {emails.map((email, index) => (
                    <Grid item key={index}>
                      <Chip
                        label={email}
                        onDelete={() => {
                          const emailsClone = [...emails];
                          emailsClone.splice(index, 1);
                          setEmails(emailsClone);
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
              <TextField
                fullWidth
                size="small"
                helperText={t('add_20_users')}
                label={t('enter_email')}
                placeholder={t('example@email.com')}
                name="email"
                value={currentEmail}
                onChange={(event) => {
                  setCurrentEmail(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (['Enter', 'Tab'].includes(event.key)) {
                    if (verifyCurrentEmail()) {
                      const emailsClone = [...emails];
                      emailsClone.push(currentEmail);
                      setEmails(emailsClone);
                      setCurrentEmail('');
                    }
                  }
                }}
                variant={'outlined'}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />
              <Box
                ref={bottomRef}
                sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2.5 }}
              >
                <Button
                  color="inherit"
                  onClick={onClose}
                  disabled={isInviteSubmitting}
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={async () => {
                    setIsInviteSubmitting(true);
                    const invite = (emails: string[]) =>
                      dispatch(inviteUsers(roleId, emails, false))
                        .then(() => {
                          onClose();
                          setEmails([]);
                          setCurrentEmail('');
                          showSnackBar(t('users_invite_success'), 'success');
                        })
                        .catch((err: { message: string }) => {
                          showSnackBar(JSON.parse(err.message).message, 'error');
                        })
                        .finally(() => setIsInviteSubmitting(false));
                    if (roleId) {
                      if (emails.length || currentEmail) {
                        if (currentEmail) {
                          if (verifyCurrentEmail())
                            invite([...emails, currentEmail]);
                        } else {
                          invite(emails);
                        }
                      } else {
                        showSnackBar(t('please_type_emails'), 'error');
                        setIsInviteSubmitting(false);
                      }
                    } else {
                      showSnackBar(t('please_select_role'), 'error');
                      setIsInviteSubmitting(false);
                    }
                  }}
                  variant="contained"
                  startIcon={
                    isInviteSubmitting ? <CircularProgress size="1rem" /> : null
                  }
                  disabled={isInviteSubmitting}
                >
                  {t('invite')}
                </Button>
              </Box>
            </>
          ) : (
            roleId && (
              <>
                <CreateUser
                  roleId={roleId}
                  onClose={onClose}
                  onRefreshUsers={onRefreshUsers}
                />
                <Box ref={bottomRef} />
              </>
            )
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
