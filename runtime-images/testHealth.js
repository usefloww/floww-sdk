#!/usr/bin/env node
// Test health endpoint for Docker runtime

const port = process.argv[2] || '8000';

console.log('Testing health endpoint...');

(async () => {
    try {
        const response = await fetch(`http://localhost:${port}/health`);
        const data = await response.json();

        console.log('Response:', JSON.stringify(data));

        if (data.status === 'ok') {
            console.log('✓ Health check passed');
            process.exit(0);
        } else {
            console.error('✗ Health check failed: invalid response structure');
            process.exit(1);
        }
    } catch (error) {
        console.error('✗ Health check failed:', error.message);
        process.exit(1);
    }
})();
