const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

const IMAGE_URL = 'https://webcams.nyctmc.org/api/cameras/074b4e06-5090-47a5-b672-8b15780c9255/image';
const MOONDREAM_API_URL = 'http://localhost:20200/v1/point';
const MOONDREAM_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlfaWQiOiJhNjNjMDAyZC1hZjI3LTQzMTAtYWY0NC0zMjBjOTEzZjE4N2UiLCJvcmdfaWQiOiJLNFc3d3R5Yk9td0EwMFVTQ2Q3WmFZaDVQcGNkazg1WSIsImlhdCI6MTc1MDYwOTM2NywidmVyIjoxfQ.wsuk_IKAgKkfsHLJpWiavGps8XrLPmkW8WOnoUZZh5E';

let bikeCount = 0;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/bike-count', (req, res) => {
    res.json({ count: bikeCount });
});

app.post('/increment-bike-count', (req, res) => {
    const { count } = req.body;
    if (typeof count === 'number') {
        bikeCount += count;
        res.status(200).json({ success: true, newCount: bikeCount });
    } else {
        res.status(400).json({ success: false, message: 'Invalid count provided.' });
    }
});

app.get('/fetch-image', async (req, res) => {
    try {
        const response = await fetch(IMAGE_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const imageBuffer = await response.arrayBuffer();
        res.set('Content-Type', response.headers.get('content-type'));
        res.send(Buffer.from(imageBuffer));
    } catch (error) {
        console.error('Error fetching image:', error.message);
        res.status(500).send('Failed to fetch image');
    }
});

app.post('/analyze-image', async (req, res) => {
    try {
        const { image_url, description } = req.body;
        if (!image_url || !description) {
            return res.status(400).json({ detail: 'Missing image_url or description in request body' });
        }

        const apiRequestConfig = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Moondream-Auth': `${MOONDREAM_API_KEY}`,
            },
            body: JSON.stringify({
                image_url: image_url,
                object: description,
            }),
        };

        console.log('Sending request to Moondream API with headers:', apiRequestConfig.headers);

        const response = await fetch(MOONDREAM_API_URL, apiRequestConfig);
        const responseData = await response.json();

        if (!response.ok) {
            const error = new Error();
            error.response = {
                status: response.status,
                data: responseData,
            };
            throw error;
        }

        res.json(responseData);
    } catch (error) {
        console.error('Error calling Moondream API:', error.response ? error.response.data : error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response ? error.response.data : { detail: 'Failed to analyze image' };
        res.status(status).json(message);
    }
});

app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
}); 
