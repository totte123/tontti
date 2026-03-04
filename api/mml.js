export default async function handler(req, res) {
    const apiKey = process.env.VITE_MML_API_KEY || process.env.MML_API_KEY;
  
    if (!apiKey) {
      console.error('API key missing in Vercel env');
      return res.status(500).json({ error: 'API key missing' });
    }
  
    // Debug: tulosta avaimen alku logiin (näkyy Vercelin Logs)
    console.log('Proxy: käytetty avain (ensimmäiset 8 merkkiä):', apiKey.substring(0, 8));
  
    const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;
    console.log('Proxy: Authorization-header (ensimmäiset 20 merkkiä):', authHeader.substring(0, 20));
  
    const targetUrl = `https://avoin-paikkatieto.maanmittauslaitos.fi${req.url}`;
  
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
          message: response.status === 400 ? 'Bad Request – tarkista avain tai parametri' : 'MML-virhe',
          raw: text.substring(0, 500)
        });
      }
  
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch {
        res.status(500).json({
          error: 'MML returned invalid JSON',
          raw: text.substring(0, 500)
        });
      }
    } catch (error) {
      console.error('Proxy fetch failed:', error);
      res.status(500).json({ error: 'Proxy connection failed', details: error.message });
    }
  }