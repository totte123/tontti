export default async function handler(req, res) {
    const url = `https://avoin-paikkatieto.maanmittauslaitos.fi${req.url}`;
    try {
      const response = await fetch(url, {
        method: req.method,
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.VITE_MML_API_KEY + ':').toString('base64')}`,  // ← korjattu VITE_-etuliitteellä
          'Accept': 'application/geo+json',
        },
      });
  
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: 'Proxy error', details: error.message });
    }
  }