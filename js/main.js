// Please replace 'YOUR_API_KEY' with your actual Moondream AI API key.
const MOONDREAM_API_URL = 'http://localhost:3000/analyze-image';
const IMAGE_URL = 'http://localhost:3000/fetch-image';

// NOTE: Due to browser security (CORS), fetching the image and calling the Moondream API
// from a client-side script like this will likely be blocked.
// To make this work, you would need to run this through a server-side proxy
// to bypass the CORS restrictions. Another option for local testing is to use
// a browser extension that disables CORS, but this is not recommended for production.

const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const statusElement = document.querySelector('p');
const statsElement = document.getElementById('stats');
let isAnalyzing = false;

async function updateBikeCount(count) {
    if (count > 0) {
        await fetch('http://localhost:3000/increment-bike-count', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ count: count }),
        });
    }
}

async function fetchAndDisplayBikeCount() {
    try {
        const response = await fetch('http://localhost:3000/bike-count');
        const data = await response.json();
        statsElement.textContent = `Total bikes found so far: ${data.count}`;
    } catch (error) {
        console.error('Error fetching bike count:', error);
    }
}

async function fetchAndAnalyze() {
    if(isAnalyzing) {
        console.log('Analysis in progress, skipping this interval.');
        return;
    }
    isAnalyzing = true;
    try {
        statusElement.textContent = 'Fetching traffic camera image...';
        
        // 1. Fetch the image and draw it on the canvas
        const response = await fetch(IMAGE_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const imageBlob = await response.blob();
        const imageUrl = URL.createObjectURL(imageBlob);

        const img = new Image();
        const imgLoaded = new Promise(resolve => {
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(imageUrl); // Clean up the object URL
                resolve();
            };
        });
        img.src = imageUrl;
        await imgLoaded;

        // 2. Call the Moondream API to get points
        statusElement.textContent = 'Analyzing image for bikes...';

        const imageDataUrl = canvas.toDataURL('image/jpeg');

        const moonDreamResponse = await fetch(MOONDREAM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_url: imageDataUrl,
                description: 'are there bikes in the bikelane?'
            })
        });

        if (!moonDreamResponse.ok) {
            let errorMessage = 'Unknown error';
            const responseText = await moonDreamResponse.text();
            try {
                const errorData = JSON.parse(responseText);
                if (errorData && errorData.detail) {
                    errorMessage = errorData.detail;
                } else if (errorData && errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                } else {
                    errorMessage = JSON.stringify(errorData);
                }
            } catch (e) {
                errorMessage = responseText;
            }
            throw new Error(`Moondream API error: ${moonDreamResponse.status} - ${errorMessage}`);
        }

        const { points } = await moonDreamResponse.json();

        await updateBikeCount(points.length);
        await fetchAndDisplayBikeCount();

        // 3. Draw the points on the canvas
        statusElement.textContent = `Found ${points.length} bike(s). Drawing results.`;
        points.forEach(point => {
            const x = point.x * img.width;
            const y = point.y * img.height;

            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ff0000';
            ctx.stroke();

            ctx.font = '16px Arial';
            ctx.fillStyle = 'white';
            ctx.fillText('Bike', x + 15, y + 5);
        });

    } catch (error) {
        console.error(error);
        statusElement.textContent = `An error occurred: ${error.message}`;
        if (error.message.includes('CORS')) {
            statusElement.innerHTML += `<br>Please read the note in the JavaScript file about CORS.`;
        }
        if (error.message.includes('401')) {
            statusElement.innerHTML += `<br>Please make sure you have set your Moondream API key in js/main.js.`;
        }
    } finally {
        isAnalyzing = false;
    }
}

function main() {
    fetchAndDisplayBikeCount();
    fetchAndAnalyze();
    setInterval(fetchAndAnalyze, 2100);
}

main(); 