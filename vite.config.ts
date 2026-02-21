import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import viteReact from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from 'path';

// Heavy client-only packages that should be externalized from SSR
const clientOnlyPackages = [
  '@llamaindex/chat-ui',
  'react-pdf',
  'pdfjs-dist',
  '@codesandbox/sandpack-react',
  '@codesandbox/sandpack-client',
  'katex',
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    // Sentry source map upload (only for production builds with auth token)
    ...(process.env.SENTRY_AUTH_TOKEN ? [
      sentryVitePlugin({
        org: process.env.SENTRY_ORG || 'floww',
        project: process.env.SENTRY_PROJECT || 'floww',
        authToken: process.env.SENTRY_AUTH_TOKEN,
      })
    ] : []),
  ],
  optimizeDeps: {
    exclude: ['cpu-features', 'ssh2'],
  },
  ssr: {
    external: [...clientOnlyPackages, 'cpu-features', 'ssh2', 'adminjs', 'adminjs-drizzle'],
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname)
    }
  },
});
