#!/usr/bin/env node
// Test invocation endpoint for Docker or Lambda runtime

const port = process.argv[2] || '8000';
const endpoint = process.argv[3] || '/execute';
const runtimeType = process.argv[4] || 'docker'; // 'docker' or 'lambda'

console.log(`Testing ${runtimeType} invocation endpoint...`);

// Embedded test payload - same for both Docker and Lambda

const main = `
import { Builtin } from 'floww';

export const builtin = new Builtin();

type CustomBody = {
  message: string;
};

builtin.triggers.onWebhook<CustomBody>({
  handler: (ctx, event) => {
    console.log("Webhook received:", event.body.message);
    console.log("Headers:", event.headers);
  },
  path: "/custom",
});
`;

// V2 payload format: type-agnostic with provider-aware matching
const payloadObj = {
    userCode: {
        files: {
            'main.ts': main
        },
        entrypoint: 'main.ts'
    },
    // Trigger identity - used for matching which trigger to execute
    trigger: {
        provider: {
            type: 'builtin',
            alias: 'default'
        },
        trigger_type: 'onWebhook',
        input: {
            path: '/custom',  // Must match the trigger path in user code
            method: 'POST'
        }
    },
    // Event data - passed to the trigger handler
    data: {
        method: 'POST',
        path: '/custom',
        headers: {
            'content-type': 'application/json'
        },
        body: {
            message: 'Hello from test invocation!'
        },
        query: {}
    }
};

(async () => {
    try {
        const response = await fetch(`http://localhost:${port}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payloadObj)
        });

        console.log('HTTP Status:', response.status);

        const data = await response.json();
        console.log('Response:', JSON.stringify(data));

        if (runtimeType === 'lambda') {
            // Lambda response format: { statusCode: 200, body: "{...}" }
            if (data.statusCode === 200 && data.body) {
                const body = JSON.parse(data.body);
                if (body.message && body.triggersProcessed != null) {
                    console.log('✓ Lambda invocation passed');
                    process.exit(0);
                } else {
                    console.error('✗ Lambda invocation failed: invalid body structure');
                    console.error('Expected: message and triggersProcessed fields');
                    process.exit(1);
                }
            } else {
                console.error('✗ Lambda invocation failed: invalid response structure');
                console.error('Expected: statusCode=200 and body field');
                process.exit(1);
            }
        } else {
            // Docker response format: { statusCode: 200, message: "...", triggersProcessed: N }
            if (response.status === 200 && data.statusCode === 200 && data.message && data.triggersProcessed != null) {
                console.log('✓ Execute endpoint passed');
                process.exit(0);
            } else {
                console.error('✗ Execute endpoint failed');
                console.error('Expected: HTTP 200 with statusCode=200, message, and triggersProcessed fields');
                process.exit(1);
            }
        }
    } catch (error) {
        console.error('✗ Invocation failed:', error.message);
        process.exit(1);
    }
})();
