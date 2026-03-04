export default async function handler(req, res) {
    const apiKey = process.env.VITE_MML_API_KEY || process.env.MML_API_KEY;
  
    if (!apiKey) {
      console.error('API key puuttuu Vercelin env-varista');
      return res.status(500).json({ error: 'API key puuttuu Vercelissä' });
    }
  
    // Debug: varmista että avain on oikein
    console.log('Proxy: avain pituus:', apiKey.length);
    console.log('Proxy: avain alku:', apiKey.substring(0, 8));
  
    // Muodosta Basic Auth TÄSMÄLLEEN oikein
    const authString = apiKey + ':';
    const base64Auth = btoa(authString);  // Käytä btoa (browser/Node-yhteensopiva) Bufferin sijaan
    const authHeader = `Basic ${base64Auth}`;
  
    console.log('Proxy: Authorization-header alku:', authHeader.substring(0, 20));
  
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
        console.error('MML virhe:', response.status, text.substring(0, 300));
        return res.status(response.status).json({
          error: 'MML API hylkäsi pyynnön',
          status: response.status,
          message: response.status === 400 ? 'Bad Request – avain tai parametri virheellinen' : 'MML-virhe',
          raw: text.substring(0, 500)
        });
      }
  
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (parseError) {
        console.error('JSON parse epäonnistui:', parseError, text.substring(0, 300));
        res.status(500).json({
          error: 'MML palautti ei-JSON-vastauksen',
          raw: text.substring(0, 500)
        });
      }
    } catch (error) {
      console.error('Proxy fetch epäonnistui:', error);
      res.status(500).json({ error: 'Proxy-yhteysvirhe', details: error.message });
    }
  }