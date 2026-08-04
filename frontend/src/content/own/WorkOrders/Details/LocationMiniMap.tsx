import { Box } from '@mui/material';

interface LocationMiniMapProps {
  latitude: number;
  longitude: number;
  height?: number;
}

// Mapa leve via embed do OpenStreetMap - sem chave de API, sem dependencia
// nova. O Map existente (components/Map) usa Google Maps e precisa de
// GOOGLE_KEY configurada (vazia neste ambiente); esse aqui funciona sem
// nenhuma configuracao.
export default function LocationMiniMap({
  latitude,
  longitude,
  height = 220
}: LocationMiniMapProps) {
  const delta = 0.006;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta
  ].join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <Box
      sx={{
        borderRadius: 1,
        overflow: 'hidden',
        border: (theme) => `1px solid ${theme.palette.divider}`,
        height
      }}
    >
      <iframe
        title="location-map"
        src={src}
        style={{ border: 0, width: '100%', height: '100%' }}
        loading="lazy"
      />
    </Box>
  );
}
