export default async function handler(req, res) {
    // Varmista avain (käytä nimeä, joka on Vercelissä Environment Variables -osiossa)
    const apiKey = process.env.VITE_MML_API_KEY;
  
    if (!apiKey) {
      console.error('API key missing in Vercel env vars');
      return res.status(500).json({ error: 'API key missing in Vercel' });
    }
  
    // Debug-loki: tulosta avaimen alku (näkyy Vercelin Logs-välilehdellä)
    console.log('Proxy: käytetty avain (ensimmäiset 8 merkkiä):', apiKey.substring(0, 8));
  
    // Muodosta Authorization-header TÄSMÄLLEEN oikein
    const authString = `${apiKey}:`;  // avain + tyhjä salasana
    const authHeader = 'Basic ' + Buffer.from(authString).toString('base64');
  
    console.log('Proxy: Authorization-header (ensimmäiset 20 merkkiä):', authHeader.substring(0, 20));
  
    // Poista ylimääräinen /api/mml polusta
    let path = req.url;
    if (path.startsWith('/api/mml')) {
      path = path.replace('/api/mml', '');
    }
  
    const targetUrl = `https://avoin-paikkatieto.maanmittauslaitos.fi${path}`;
  
    console.log('Proxy: target URL:', targetUrl);
  
    try {
      const response = await fetch(targetUrl, {
        method: req.method || 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/geo+json',
        },
      });
  
      const text = await response.text();
  
      if (!response.ok) {
        console.error('MML API virhe:', response.status, text.substring(0, 300));
        return res.status(response.status).json({
          error: 'MML API error',
          status: response.status,
          message: response.status === 404 ? 'Kiinteistöä ei löytynyt avoimesta aineistosta' : 'MML-palvelinvirhe',
          raw: text.substring(0, 500)
        });
      }
  
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (parseError) {
        console.error('JSON parse failed:', parseError, text.substring(0, 300));
        res.status(500).json({
          error: 'MML returned invalid JSON (HTML?)',
          raw: text.substring(0, 500)
        });
      }
    } catch (error) {
      console.error('Proxy fetch failed:', error);
      res.status(500).json({ error: 'Proxy connection failed', details: error.message });
    }
  }