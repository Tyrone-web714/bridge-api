import React, { useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { getDriverSessionHeaders } from '../services/driverSession';

function cleanText(value) {
  return String(value || '').trim();
}

export function isPrivateTsrMedia(media = {}) {
  const url = cleanText(media.url);
  const accessPath = cleanText(media.accessPath || media.access_path);
  const classification = cleanText(media.mediaClassification || media.media_classification).toUpperCase();
  return classification === 'ORGANIZATION_PRIVATE'
    || accessPath.startsWith('/api/media/')
    || /\/api\/media\/[^/?#]+/i.test(url);
}

export function absoluteMediaUri(media = {}) {
  const accessPath = cleanText(media.accessPath || media.access_path);
  const url = cleanText(media.url || media.uri || media.publicUrl);
  const candidate = accessPath || url;
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate) || candidate.startsWith('file:') || candidate.startsWith('content:') || candidate.startsWith('data:')) {
    return candidate;
  }
  if (candidate.startsWith('/')) {
    return `${API_BASE_URL.replace(/\/+$/, '')}${candidate}`;
  }
  return candidate;
}

export function buildAuthenticatedMediaSource(media = {}) {
  const uri = absoluteMediaUri(media);
  if (!uri) return null;
  if (!isPrivateTsrMedia(media)) return { uri };

  const headers = getDriverSessionHeaders();
  return Object.keys(headers).length ? { uri, headers } : { uri };
}

export default function AuthenticatedMediaImage({
  media,
  style,
  resizeMode = 'cover',
  fallbackText = 'Photo unavailable',
  onError,
  ...imageProps
}) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => buildAuthenticatedMediaSource(media), [media]);

  if (!source || failed) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#d7e5ef', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>
          {fallbackText}
        </Text>
      </View>
    );
  }

  return (
    <Image
      {...imageProps}
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
