// ... (importit ja alkuosat ennallaan)

const initialSuosikit = ['434-443-2-33', '434-463-5-77'];

function App() {
  const [kiinteistoTunnus, setKiinteistoTunnus] = useState('');
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [insideTontti, setInsideTontti] = useState(null);
  const [suosikit, setSuosikit] = useState(() => {
    const saved = localStorage.getItem('tonttiSuosikit');
    return saved ? JSON.parse(saved) : initialSuosikit;
  });

  const mapRef = useRef(null);

  // Tallenna suosikit localStorageen aina kun ne muuttuvat
  useEffect(() => {
    localStorage.setItem('tonttiSuosikit', JSON.stringify(suosikit));
  }, [suosikit]);

  // ... (GPS-seuranta useEffect ennallaan)

  // Lisää nykyinen tunnus suosikkeihin (jos ei jo ole)
  const lisaaSuosikkiin = () => {
    if (!kiinteistoTunnus.trim()) return;
    if (suosikit.includes(kiinteistoTunnus)) return; // ei duplikaatteja

    setSuosikit(prev => [...prev, kiinteistoTunnus]);
  };

  // Poista suosikki listasta
  const poistaSuosikki = (tunnus) => {
    setSuosikit(prev => prev.filter(t => t !== tunnus));
  };

  // Valitse suosikki → täytä ja hae automaattisesti
  const valitseSuosikki = (tunnus) => {
    setKiinteistoTunnus(tunnus);
    // Hae heti (voit poistaa tämän rivin jos haluat vain täyttää inputin)
    setTimeout(haeTontti, 100); // pieni viive state-päivityksen jälkeen
  };

  // ... (haeTontti-funktio ennallaan tai korjattuna edellisen vastauksen mukaan)

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <MapContainer
        // ... ennallaan
      >
        {/* ... kartan sisältö ennallaan */}
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
            style={{ padding: '10px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', marginRight: '8px' }}
          >
            Hae
          </button>
          <button
            onClick={lisaaSuosikkiin}
            title="Lisää suosikkeihin"
            style={{ padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px' }}
          >
            +
          </button>
        </div>

        {/* Suosikit-napit */}
        {suosikit.length > 0 && (
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {suosikit.map(tunnus => (
              <div
                key={tunnus}
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
                <span
                  onClick={() => valitseSuosikki(tunnus)}
                  style={{ marginRight: '8px' }}
                >
                  {tunnus}
                </span>
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

      {/* ... (insideTontti-ilmoitus ennallaan) */}
    </div>
  );
}

export default App;