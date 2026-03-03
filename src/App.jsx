import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  GeoJSON, 
  LayersControl,
  useMap,
  CircleMarker
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-providers';
import 'leaflet.vectorgrid'; // Side-effect import
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';

// Korjaa marker-kuvakkeet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MML_API_KEY = import.meta.env.VITE_MML_API_KEY || '';

const initialSuosikit = ['434-443-2-33', '434-463-5-77', '17440100030006', '174-401-3-6'];

function App() {
  const [kiinteistoTunnus, setKiinteistoTunnus] = useState('');
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [insideTontti, setInsideTontti] = useState(null);
  const [suosikit, setSuosikit] = useState(() => {
    const saved = localStorage.getItem('tonttiSuosikit');
    return saved ? JSON.parse(saved) : initialSuosikit;
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prevTunnus, setPrevTunnus] = useState('');

  const mapRef = useRef(null);
  const vectorLayerRef = useRef(null);

  // Tallenna suosikit localStorageen aina kun ne muuttuvat
  useEffect(() => {
    localStorage.setItem('tonttiSuosikit', JSON.stringify(suosikit));
  }, [suosikit]);

  // GPS-seuranta
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Selain ei tue geolokaatiota');
      return;
    }

    let watchId = null;
    let retryTimer = null;

    const isMobile = /Mobi/i.test(navigator.userAgent);
    const highAccuracy = isMobile ? true : false;

    const startWatching = () => {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPosition([latitude, longitude]);
          setError(null); // onnistui → tyhjennä virheviesti

          if (geoJsonData && geoJsonData.features?.length > 0) {
            const point = turf.point([longitude, latitude]);

            let combinedGeometry;
            if (geoJsonData.features.length === 1) {
              combinedGeometry = geoJsonData.features[0].geometry;
            } else {
              const polys = geoJsonData.features.map(f => f.geometry);
              combinedGeometry = turf.multiPolygon(polys.map(p => p.coordinates));
            }

            setInsideTontti(turf.booleanPointInPolygon(point, combinedGeometry));
          }
        },
        (err) => {
          console.error('GPS-virhe:', err);

          let userMessage = 'Sijainnin haku epäonnistui';
          switch (err.code) {
            case 1:
              userMessage = 'Sijaintilupa evätty – salli se selaimen asetuksista';
              break;
            case 2:
              userMessage = 'Sijaintitieto ei ole saatavilla tällä hetkellä';
              if (!highAccuracy) {
                userMessage += ' (kokeile mobiililaitteella tarkempaa sijaintia)';
              }
              break;
            case 3:
              userMessage = 'Sijainnin haku aikakatkaistiin – yritetään uudelleen';
              break;
            default:
              userMessage = `Tuntematon virhe (${err.code}): ${err.message}`;
          }

          setError(userMessage);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 15000,
          maximumAge: 30000
        }
      );
    };

    startWatching();

    // Retry-mekanismi jos sijaintia ei saada
    retryTimer = setInterval(() => {
      if (!userPosition) {
        console.log('GPS-retry: ei sijaintia vielä → yritetään uudelleen');
        if (watchId) navigator.geolocation.clearWatch(watchId);
        startWatching();
      }
    }, 20000);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [geoJsonData]);

  // Lisää nykyinen tunnus suosikkeihin (jos ei jo ole)
  const lisaaSuosikkiin = () => {
    if (!kiinteistoTunnus.trim()) return;
    if (suosikit.includes(kiinteistoTunnus)) return;

    setSuosikit(prev => [...prev, kiinteistoTunnus]);
  };

  // Poista suosikki listasta
  const poistaSuosikki = (tunnus) => {
    setSuosikit(prev => prev.filter(t => t !== tunnus));
  };

  
  // Hae yksittäinen tontti
  const haeTontti = async () => {
    setLoading(true);
    if (!kiinteistoTunnus.trim() || !MML_API_KEY) {
      alert('Syötä tunnus ja varmista VITE_MML_API_KEY .env-tiedostossa');
      return;
    }

    setGeoJsonData(null);
    setError(null);

    try {
      const url = `/mml-api/kiinteisto-avoin/simple-features/v3/collections/PalstanSijaintitiedot/items?kiinteistotunnuksenEsitysmuoto=${encodeURIComponent(kiinteistoTunnus)}&limit=10`;

      console.log('Proxy-URL:', url);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(MML_API_KEY + ':'),
          'Accept': 'application/geo+json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Virhe status:', res.status, errorText);
        alert(`Virhe ${res.status}: ${errorText.substring(0, 300)}`);
        return;
      }

      const data = await res.json();

      console.log('Saatu data:', data);

      if (!data.features || data.features.length === 0) {
        alert('Ei löytynyt palstoja tällä kiinteistötunnuksella');
        return;
      }
      setGeoJsonData(data);
      setLoading(false);

      if (mapRef.current) {
        const gjLayer = L.geoJSON(data);
        const bounds = gjLayer.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [80, 80] });
        }
      }
    } catch (err) {
      console.error('Fetch- tai JSON-virhe:', err);
      alert('Haku epäonnistui – katso konsoli');
    }
  };

  const valitseSuosikki = (tunnus) => {
    setKiinteistoTunnus(tunnus);
  };
  // Tämä useEffect ajaa haun vain kun tunnus todella muuttuu
useEffect(() => {
  if (
    kiinteistoTunnus.trim() && 
    kiinteistoTunnus !== prevTunnus && 
    MML_API_KEY  // Varmista että avain on saatavilla
  ) {
    haeTontti();
    setPrevTunnus(kiinteistoTunnus);
  }
}, [kiinteistoTunnus, MML_API_KEY]);

  // Vektoritiili-layer (kaikki rajat taustalle)
  useEffect(() => {
    if (!mapRef.current || !MML_API_KEY) return;

    if (vectorLayerRef.current) {
      mapRef.current.removeLayer(vectorLayerRef.current);
    }

    const tileMatrixSet = 'WGS84_Pseudo-Mercator';

    const vectorTileOptions = {
      rendererFactory: L.svg.tile,
      vectorTileLayerStyles: {
        'kiinteistorajan_sijaintitiedot': {
          color: '#ff0000',
          weight: 2,
          opacity: 0.8,
        },
        'palstan_sijaintitiedot': {
          color: '#ff0000',
          fillOpacity: 0.1,
          fillColor: '#ffcccc',
        },
        'kiinteistotunnuksen_sijaintitiedot': {
          color: '#000000',
          weight: 1,
        },
      },
      interactive: true,
      getFeatureId: (f) => f.properties?.kiinteistotunnus || null,
    };

    const vectorGrid = L.vectorGrid.protobuf(
      `https://avoin-karttakuva.maanmittauslaitos.fi/kiinteisto-avoin/tiles/wmts/1.0.0/kiinteistojaotus/default/v3/${tileMatrixSet}/{z}/{y}/{x}.pbf?api-key=${MML_API_KEY}`,
      vectorTileOptions
    );

    vectorGrid.on('click', (e) => {
      const props = e.layer.properties;
      if (props) {
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`Kiinteistötunnus: ${props.kiinteistotunnus || 'Ei saatavilla'}`)
          .openOn(mapRef.current);
      }
    });

    vectorGrid.addTo(mapRef.current);
    vectorLayerRef.current = vectorGrid;
  }, [MML_API_KEY]);

  const tonttiStyle = { color: '#ff0000', weight: 5, fillOpacity: 0.2 };

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <MapContainer
        center={[60.1699, 24.9384]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <MapInitializer mapRef={mapRef} />
        {/* Layers Control - valikko oikeassa yläkulmassa */}
        <LayersControl position="topright">
        <LayersControl.BaseLayer name="Satelliitti (Esri World Imagery)">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='Tiles &copy; Esri'
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer checked name="Tumma kartta (CartoDB DarkMatter)">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Minimalistinen vaalea (CartoDB Positron)">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
        </LayersControl.BaseLayer>
      </LayersControl>

        {/* Loput kerrokset */}
        {userPosition && (
          <CircleMarker
          key={`user-position-${userPosition[0]}-${userPosition[1]}`}
            center={userPosition}
            radius={8}                  // koko pikseleissä (ei metreissä) – suositeltu 8–15
            pathOptions={{
              color: !insideTontti ? '#32CD32' : '#FF4500',
fillColor: !insideTontti ? '#32CD32' : '#FF4500',
              fillOpacity: 0.7,                          // läpinäkyvyys
              weight: 3,                                 // reunan paksuus
              opacity: 1
            }}
          >
            <Popup>
              Sijaintisi {insideTontti ? 'tontin sisällä ✓' : 'ei tontin sisällä'}
            </Popup>
          </CircleMarker>
        )}

        {geoJsonData && (
          <GeoJSON data={geoJsonData} style={tonttiStyle}>
            <Popup>Tontti: {kiinteistoTunnus}</Popup>
          </GeoJSON>
        )}

      </MapContainer>

      {/* Hakupalkki + suosikit */}
      <div style={{
        position: 'absolute',
        top: 15,
        left: 15,
        zIndex: 1000,
        background: 'white',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        minWidth: '340px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <input
            value={kiinteistoTunnus}
            onChange={(e) => setKiinteistoTunnus(e.target.value)}
            placeholder="Kiinteistötunnus (esim. 740-555-2-0)"
            style={{ flex: 1, padding: '10px', marginRight: '8px' }}
          />
          <button
            onClick={haeTontti}
            disabled={loading}
            style={{ padding: '10px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', marginRight: '8px' }}
          >
            {loading ? 'Haetaan...' : 'Hae'}
          </button>
          <button
            onClick={lisaaSuosikkiin}
            title="Lisää suosikkeihin"
            style={{ padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px' }}
          >
            +
          </button>
          <button
            onClick={() => {
              // Hae tuore ref suoraan (vältä closure)
              const currentMap = mapRef.current;
            
              console.log('Nappi painettu – currentMap:', currentMap ? 'OK' : 'null');
            
              if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
                alert('Ei tontin rajoja saatavilla');
                return;
              }
            
              if (!currentMap) {
                alert('Karttaviite puuttuu – odota että kartta on täysin latautunut');
                return;
              }
            
              const gjLayer = L.geoJSON(geoJsonData);
              const bounds = gjLayer.getBounds();
            
              if (bounds.isValid()) {
                currentMap.fitBounds(bounds, { padding: [80, 80], animate: true, duration: 1.0 });
                console.log('Keskitys onnistui');
              } else {
                alert('Bounds ei validi');
              }
            }}
            disabled={!geoJsonData}
            style={{
              padding: '10px 16px',
              background: geoJsonData ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              marginLeft: '8px',
              cursor: geoJsonData ? 'pointer' : 'not-allowed'
            }}
          >
            Siirrä tontille
          </button>
        </div>

        {suosikit.length > 0 && (
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suosikit.map(tunnus => (
              <div
                key={tunnus}
                onClick={() => valitseSuosikki(tunnus)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f8f9fa',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <span style={{ marginRight: '8px' }}>{tunnus}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    poistaSuosikki(tunnus);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc3545',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: '0 4px'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {suosikit.length === 0 && (
          <small style={{ color: '#6c757d', marginTop: '8px', display: 'block' }}>
            Ei suosikkeja vielä – lisää + -napilla
          </small>
        )}
      </div>

      {/* Virheviesti GPS:stä */}
      {error && (
        <div style={{
          position: 'absolute',
          top: 100,
          left: 15,
          zIndex: 1000,
          background: 'rgba(220, 53, 69, 0.9)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {error}
        </div>
      )}

      {/* Sisällä/ulkona -ilmoitus */}
      {insideTontti !== null && (
        <div style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          background: insideTontti ? 'green' : 'orange',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '30px',
          zIndex: 1000
        }}>
          {insideTontti ? 'Olet tontin sisällä' : 'Et ole tontin sisällä'}
        </div>
      )}
    </div>
  );
}

export default App;

function MapInitializer({ mapRef }) {
  const map = useMap(); // Tämä hook palauttaa Leaflet map-instanssin kun se on valmis

  useEffect(() => {
    if (map && mapRef) {
      mapRef.current = map;
      console.log('MapInitializer: karttaviite asetettu prop-ref:iin');
      
      setTimeout(() => {
        map.invalidateSize();
        console.log('invalidateSize kutsuttu');
      }, 100);
    }
  }, [map, mapRef]);

  return null; // Ei renderöi mitään
}
