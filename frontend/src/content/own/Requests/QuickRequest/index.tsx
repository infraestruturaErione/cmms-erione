import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import {
  Autocomplete,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import { useDispatch, useSelector } from 'src/store';
import { addRequest } from 'src/slices/request';
import { getCustomersMini } from 'src/slices/customer';
import { getLocations } from 'src/slices/location';
import { getAssetsMini } from 'src/slices/asset';
import { getCategories } from 'src/slices/category';
import { TitleContext } from 'src/contexts/TitleContext';
import { CompanySettingsContext } from 'src/contexts/CompanySettingsContext';
import { CustomSnackBarContext } from 'src/contexts/CustomSnackBarContext';
import { getImageAndFiles } from 'src/utils/overall';
import { CustomerMiniDTO } from 'src/models/owns/customer';
import Location from 'src/models/owns/location';
import { AssetMiniDTO } from 'src/models/owns/asset';
import Category from 'src/models/owns/category';
import type { Priority } from 'src/models/owns/workOrder';

const priorityKeys: { value: Priority; key: string }[] = [
  { value: 'NONE', key: 'none_priority' },
  { value: 'LOW', key: 'low_priority' },
  { value: 'MEDIUM', key: 'medium_priority' },
  { value: 'HIGH', key: 'high_priority' }
];

function QuickRequest() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { setTitle } = useContext(TitleContext);
  const { uploadFiles } = useContext(CompanySettingsContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);

  const { customersMini } = useSelector((state) => state.customers);
  const { locations } = useSelector((state) => state.locations);
  const { assetsMini } = useSelector((state) => state.assets);
  const { categories } = useSelector((state) => state.categories);
  const workOrderCategories: Category[] = categories['work-order-categories'] || [];

  const [customer, setCustomer] = useState<CustomerMiniDTO | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [asset, setAsset] = useState<AssetMiniDTO | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [priority, setPriority] = useState<Priority>('NONE');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTitle(t('quick_request'));
  }, [setTitle, t]);

  useEffect(() => {
    dispatch(getCustomersMini());
    dispatch(getLocations());
    dispatch(getAssetsMini());
    dispatch(getCategories('work-order-categories'));
  }, [dispatch]);

  const filteredLocations = customer
    ? locations.filter((loc) =>
        loc.customers?.some((customer1) => customer1.id === customer.id)
      )
    : locations;

  const filteredAssets = location
    ? assetsMini.filter((a) => a.locationId === location.id)
    : assetsMini;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setImageFile(e.target.files[0]);
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setOtherFiles(Array.from(e.target.files));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showSnackBar(t('quick_request_description_required'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const uploadedFiles = await uploadFiles(
        otherFiles,
        imageFile ? [imageFile] : []
      );
      const { image, files } = getImageAndFiles(uploadedFiles);

      const customerName = customer?.name || t('quick_request_no_customer');
      const today = new Date().toLocaleDateString();
      const payload: Record<string, unknown> = {
        title: t('quick_request_auto_title', {
          customer: customerName,
          date: today
        }),
        description,
        priority,
        contact: contact || undefined,
        image: image || undefined,
        files: files || []
      };
      if (customer) payload.customers = [{ id: customer.id }];
      if (location) payload.location = { id: location.id };
      if (asset) payload.asset = { id: asset.id };
      if (category) payload.category = { id: category.id };

      await dispatch(addRequest(payload));
      showSnackBar(t('quick_request_success'), 'success');
      navigate('/app/requests');
    } catch {
      showSnackBar(t('quick_request_error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const SectionHeading = ({
    index,
    title,
    helper
  }: {
    index: number;
    title: string;
    helper?: string;
  }) => (
    <Box display="flex" gap={1.5} alignItems="flex-start" mb={2}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(theme.colors.primary.main, 0.1),
          color: 'primary.main',
          fontWeight: 700,
          flex: '0 0 auto'
        }}
      >
        {index}
      </Box>
      <Box>
        <Typography variant="h5">{title}</Typography>
        {helper && (
          <Typography variant="body2" color="text.secondary">
            {helper}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      <Helmet>
        <title>{t('quick_request')}</title>
      </Helmet>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              border: `1px solid ${alpha(theme.colors.alpha.black[100], 0.08)}`,
              borderRadius: 1,
              bgcolor: 'background.paper'
            }}
          >
            <Typography variant="h3" gutterBottom>
              {t('quick_request')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('quick_request_subtitle')}
            </Typography>
          </Box>

          <Card variant="outlined" sx={{ boxShadow: 'none' }}>
            <CardContent>
              <SectionHeading
                index={1}
                title={t('quick_request_where')}
                helper={t('quick_request_where_helper')}
              />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Autocomplete
                    fullWidth
                    options={customersMini}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                    value={customer}
                    onChange={(_, v) => {
                      setCustomer(v as CustomerMiniDTO | null);
                      setLocation(null);
                      setAsset(null);
                    }}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    renderInput={(params) => (
                      <TextField {...params} label={t('customer')} />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Autocomplete
                    fullWidth
                    options={filteredLocations}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                    value={location}
                    onChange={(_, v) => {
                      setLocation(v as Location | null);
                      setAsset(null);
                    }}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    noOptionsText={t('quick_request_no_locations')}
                    renderInput={(params) => (
                      <TextField {...params} label={t('location')} />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Autocomplete
                    fullWidth
                    options={filteredAssets}
                    getOptionLabel={(o) =>
                      typeof o === 'string' ? o : `${o.name} (${o.customId})`
                    }
                    value={asset}
                    onChange={(_, v) => setAsset(v as AssetMiniDTO | null)}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    noOptionsText={t('quick_request_no_assets')}
                    renderInput={(params) => (
                      <TextField {...params} label={t('camera_equipment')} />
                    )}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ boxShadow: 'none' }}>
            <CardContent>
              <SectionHeading index={2} title={t('quick_request_what')} />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    fullWidth
                    options={workOrderCategories}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                    value={category}
                    onChange={(_, v) => setCategory(v as Category | null)}
                    isOptionEqualToValue={(o, v) => o.id === v.id}
                    renderInput={(params) => (
                      <TextField {...params} label={t('category')} />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    fullWidth
                    options={priorityKeys}
                    getOptionLabel={(o) => (typeof o === 'string' ? o : t(o.key))}
                    value={priorityKeys.find((p) => p.value === priority) || null}
                    onChange={(_, v) =>
                      setPriority(
                        v ? (v as { value: Priority; key: string }).value : 'NONE'
                      )
                    }
                    isOptionEqualToValue={(o, v) => o.value === v.value}
                    renderInput={(params) => (
                      <TextField {...params} label={t('priority')} />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    maxRows={8}
                    label={t('description')}
                    placeholder={t('quick_request_description_placeholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ boxShadow: 'none' }}>
            <CardContent>
              <SectionHeading
                index={3}
                title={t('quick_request_evidence')}
                helper={t('quick_request_evidence_helper')}
              />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button variant="outlined" component="label" fullWidth sx={{ py: 3 }}>
                    {imageFile ? imageFile.name : t('quick_request_add_image')}
                    <input type="file" accept="image/*" hidden onChange={handleImageChange} />
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button variant="outlined" component="label" fullWidth sx={{ py: 3 }}>
                    {otherFiles.length > 0
                      ? t('quick_request_files_selected', {
                          count: otherFiles.length
                        })
                      : t('quick_request_add_files')}
                    <input type="file" multiple hidden onChange={handleFilesChange} />
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ boxShadow: 'none' }}>
            <CardContent>
              <SectionHeading
                index={4}
                title={t('quick_request_contact')}
                helper={t('quick_request_contact_helper')}
              />
              <TextField
                fullWidth
                label={t('contact')}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </CardContent>
          </Card>

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button variant="text" onClick={() => navigate('/app/requests')}>
              {t('cancel')}
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={20} /> : undefined}
            >
              {t('quick_request_submit')}
            </Button>
          </Box>
        </Stack>
      </Container>
    </>
  );
}

export default QuickRequest;
