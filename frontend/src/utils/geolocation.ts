export interface Coordinates {
  latitude?: number;
  longitude?: number;
}

export interface GeolocationResult extends Coordinates {
  error?: string;
}

const GEO_ERROR_MESSAGES: Record<number, string> = {
  [GeolocationPositionError.PERMISSION_DENIED]: 'geolocation_permission_denied',
  [GeolocationPositionError.POSITION_UNAVAILABLE]: 'geolocation_unavailable',
  [GeolocationPositionError.TIMEOUT]: 'geolocation_timeout'
};

export function getCoordinates(timeout = 15000): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({ error: 'geolocation_not_supported' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude
        }),
      (err) => {
        const errorKey = GEO_ERROR_MESSAGES[err.code] ?? 'geolocation_unknown_error';
        resolve({ error: errorKey });
      },
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}
