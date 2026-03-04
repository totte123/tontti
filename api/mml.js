export default async function handler(req, res) {
    const targetUrl = `https://avoin-paikkatieto.maanmittauslaitos.fi${req.url}`;
    const apiKey = process.env.VITE_MML_API_KEY || process.env.MML_API_KEY;
  
    if (!apiKey) {
      return res.status(500).json({ error: 'API key missing' });
    }
  
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Accept': 'application/geo+json',
      },
    });
  
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } catch {
      res.status(response.status).send(text); // palauttaa HTML:n sellaisenaan frontendille
    }
  }