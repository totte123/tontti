export default async function handler(req, res) {
    // Ota avain Vercelin env-muuttujasta (käytä samaa nimeä kuin lisäsit Settings → Environment Variables)
    const apiKey = process.env.VITE_MML_API_KEY || process.env.MML_API_KEY;
  
    if (!apiKey) {
      return res.status(500).json({ error: 'API key missing in Vercel env' });
    }
  
    // Varmista, että URL alkaa oikealla polulla
    const path = req.url.startsWith('/api/mml') ? req.url.replace('/api/mml', '') : req.url;
    const targetUrl = `https://avoin-paikkatieto.maanmittauslaitos.fi${path}`;
  
    try {
      const response = await fetch(targetUrl, {
        method: req.method || 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'Accept': 'application/geo+json',
        },
      });
  
      const text = await response.text();
  
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'MML API error',
          status: response.status,
          message: response.status === 404 ? 'Kiinteistöä ei löytynyt avoimesta aineistosta' : 'MML-virhe',
          raw: text.substring(0, 300)
        });
      }
  
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch {
        res.status(500).json({
          error: 'MML returned non-JSON (HTML error page)',
          raw: text.substring(0, 500)
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Proxy failed to reach MML',
        details: error.message
      });
    }
  }