export default async function handler(req, res) {
    // Varmista että avain on Vercelissä määritelty (nimenä MML_API_KEY tai VITE_MML_API_KEY)
    const apiKey = process.env.MML_API_KEY || process.env.VITE_MML_API_KEY;
  
    if (!apiKey) {
      return res.status(500).json({
        error: 'Proxy configuration error',
        details: 'MML_API_KEY (tai VITE_MML_API_KEY) puuttuu Vercelin environment variables -osiossa'
      });
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
  
      // Lue raaka vastaus ensin (turvallisempi kuin suora json())
      const text = await response.text();
  
      // Jos status ei ole ok (esim. 404, 400), palautetaan virhe frontendille
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'MML API returned error',
          status: response.status,
          message: response.status === 404 ? 'Kiinteistötunnusta ei löytynyt avoimesta aineistosta' : 'MML-palvelinvirhe',
          rawResponse: text.substring(0, 500)  // rajoitettu pituus, ettei logi paisu
        });
      }
  
      // Jos status ok, yritä parsia JSON
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (jsonError) {
        // Jos parsinta epäonnistuu (esim. HTML-virhesivu)
        console.error('JSON parse failed:', jsonError, text.substring(0, 300));
        res.status(500).json({
          error: 'MML returned invalid JSON (likely HTML error page)',
          status: response.status,
          rawResponse: text.substring(0, 500)
        });
      }
    } catch (error) {
      console.error('Proxy fetch failed:', error);
      res.status(500).json({
        error: 'Proxy connection failed',
        details: error.message
      });
    }
  }