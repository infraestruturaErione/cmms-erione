import {
  Box,
  debounce,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Field, Formik } from 'formik';
import * as Yup from 'yup';
import useAuth from '../../../../hooks/useAuth';
import internationalization, {
  loadLanguage,
  supportedLanguages
} from '../../../../i18n/i18n';
import { useContext, useMemo } from 'react';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';

function GeneralSettings() {
  const { t }: { t: any } = useTranslation();
  const switchLanguage = async ({ lng }: { lng: any }) => {
    await loadLanguage(lng);
    internationalization.changeLanguage(lng);
  };
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { patchGeneralPreferences, companySettings } = useAuth();
  const { generalPreferences } = companySettings;

  const onDaysBeforePMNotifChange = (event) =>
    patchGeneralPreferences({
      daysBeforePrevMaintNotification: Number(event.target.value)
    }).then(() => showSnackBar(t('changes_saved_success'), 'success'));
  const debouncedPMNotifChange = useMemo(
    () => debounce(onDaysBeforePMNotifChange, 1300),
    []
  );
  const onCsvSeparatorChange = (event) =>
    patchGeneralPreferences({
      csvSeparator: event.target.value
    }).then(() => showSnackBar(t('changes_saved_success'), 'success'));
  const debouncedCsvSeparatorChange = useMemo(
    () => debounce(onCsvSeparatorChange, 1300),
    []
  );
  const onSubmit = async () => {};

  return (
    <Grid item xs={12}>
      <Box p={4}>
        <Formik
          initialValues={generalPreferences}
          validationSchema={Yup.object().shape({
            language: Yup.string(),
            businessType: Yup.string()
          })}
          onSubmit={onSubmit}
        >
          {({ handleSubmit }) => (
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>
                        {t('language')}
                      </Typography>
                      <Field
                        onChange={(event) => {
                          patchGeneralPreferences({
                            language: event.target.value
                          });
                          switchLanguage({
                            lng: event.target.value.toLowerCase()
                          });
                        }}
                        value={generalPreferences.language}
                        as={Select}
                        name="language"
                      >
                        {supportedLanguages.map((language) => (
                          <MenuItem
                            key={language.code}
                            value={language.code.toUpperCase()}
                          >
                            {language.label}
                          </MenuItem>
                        ))}
                      </Field>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>
                        {t('days_before_pm_notification')}
                      </Typography>
                      <TextField
                        onChange={debouncedPMNotifChange}
                        type={'number'}
                        defaultValue={
                          generalPreferences.daysBeforePrevMaintNotification
                        }
                        name="daysBeforePrevMaintNotification"
                        InputProps={{
                          endAdornment: <Typography>{t('day')}</Typography>
                        }}
                      >
                      </TextField>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>
                        {t('csv_separator')}
                      </Typography>
                      <TextField
                        onChange={debouncedCsvSeparatorChange}
                        type={'text'}
                        defaultValue={generalPreferences.csvSeparator}
                        name="csvSeparator"
                        sx={{ maxWidth: '50px' }}
                      />
                    </Grid>
                    {/*<Grid item xs={12}>
                        <Typography variant="h6" sx={{ mb: 0.5 }}>
                          {t('business_type')}
                        </Typography>
                        <Field
                          onChange={(event) =>
                            patchGeneralPreferences({
                              businessType: event.target.value
                            })
                          }
                          value={generalPreferences.businessType}
                          as={Select}
                          name="businessType"
                        >
                          <MenuItem value="GENERAL_ASSET_MANAGEMENT">
                            {t('general_asset_management')}
                          </MenuItem>
                          <MenuItem value="PHYSICAL_ASSET_MANAGEMENT">
                            {t('physical_asset_management')}
                          </MenuItem>
                        </Field>
                      </Grid>*/}
                  </Grid>
                </Grid>
              </Grid>
            </form>
          )}
        </Formik>
      </Box>
    </Grid>
  );
}

export default GeneralSettings;
