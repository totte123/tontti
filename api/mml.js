export default async function handler(req, res) {
    const apiKey = process.env.VITE_MML_API_KEY || process.env.MML_API_KEY;
  
    if (!apiKey) {
      return res.status(500).json({ error: 'MML API key missing in Vercel env vars' });
    }
  
    const targetUrl = `https://avoin-paikkatieto.maanmittauslaitos.fi${req.url}`;
  
    try {
      const response = await fetch(targetUrl, {
        method: req.method || 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'Accept': 'application/geo+json',
        },
      });
  
      // Lue raaka vastaus ensin
      const text = await response.text();
  
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'MML API error',
          status: response.status,
          message: response.status === 404 ? 'Kiinteistöä ei löytynyt avoimesta aineistosta' : 'MML-palvelinvirhe',
          raw: text.substring(0, 300)  // rajoitettu, ettei logi paisu
        });
      }
  
      // Jos ok, yritä JSON
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (parseError) {
        return res.status(500).json({
          error: 'MML returned invalid response (likely HTML error page)',
          status: response.status,
          raw: text.substring(0, 500)
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Proxy failed to connect to MML',
        details: error.message
      });
    }
  }