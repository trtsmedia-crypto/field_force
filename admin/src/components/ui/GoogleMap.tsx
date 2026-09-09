import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: any;
    __FIELDFORCE_MAPS_KEY__?: string;
  }
}

let loadingPromise: Promise<void> | null = null;

/** Loads the Google Maps script once, however many maps end up on the page. */
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // No "loading=async" here deliberately: that flag switches Google's API
    // into a lazy-import model where google.maps.Map doesn't exist until you
    // call google.maps.importLibrary("maps") yourself. Loading the classic
    // way means every core class, including Map, is ready the moment the
    // script's onload fires — which is all this component needs.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return loadingPromise;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  selected?: boolean;
}

interface Props {
  markers: MapMarker[];
  onSelect?: (id: string) => void;
  className?: string;
}

/**
 * Real Google Map when an API key is configured (via public/config.js);
 * the caller falls back to the schematic canvas when this isn't rendered.
 */
export function GoogleMapView({ markers, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerObjsRef = useRef<Map<string, any>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const apiKey = window.__FIELDFORCE_MAPS_KEY__;

  useEffect(() => {
    if (!apiKey) {
      setError('No Maps API key configured');
      return;
    }
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch(() => setError('Could not load Google Maps'));
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const google = window.google;
    const center = markers.length
      ? { lat: markers[0].lat, lng: markers[0].lng }
      : { lat: 32.7266, lng: 74.857 }; // Jammu, as a sane default

    mapRef.current = new google.maps.Map(containerRef.current, {
      center,
      zoom: 12,
      disableDefaultUI: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = window.google;
    const map = mapRef.current;
    const seen = new Set<string>();

    for (const m of markers) {
      seen.add(m.id);
      let marker = markerObjsRef.current.get(m.id);

      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map,
          title: m.label,
        });
        if (onSelect) {
          marker.addListener('click', () => onSelect(m.id));
        }
        markerObjsRef.current.set(m.id, marker);
      } else {
        marker.setPosition({ lat: m.lat, lng: m.lng });
      }

      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: m.color,
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: m.selected ? 11 : 8,
      });
    }

    // Drop markers for employees no longer in the list (e.g. filtered out).
    for (const [id, marker] of markerObjsRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        markerObjsRef.current.delete(id);
      }
    }
  }, [markers, ready, onSelect]);

  if (error) return null; // caller renders the schematic fallback instead

  return <div ref={containerRef} className={className ?? 'h-full w-full'} />;
}

export const hasMapsKey = () => Boolean(window.__FIELDFORCE_MAPS_KEY__);
