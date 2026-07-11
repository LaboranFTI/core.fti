import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173, // Sesuaikan dengan port frontend yang biasa digunakan
        host: true, // Mengekspos ke jaringan lokal
        proxy: {
          // Semua request ke /api akan diteruskan ke backend di port 5000
          // Contoh: /api/login -> http://localhost:5000/api/login
          '/api': 'http://localhost:5000',
        }
      },
      plugins: [react(), basicSsl(), tailwindcss()],
      assetsInclude: ['**/*.JPG'],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Build optimizations
      build: {
        target: 'esnext',
        minify: 'esbuild',
        esbuildOptions: {
          drop: mode === 'production' ? ['console', 'debugger'] : [],
        },
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) {
                return undefined;
              }

              if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
                return 'vendor-react';
              }

              if (/[\\/]node_modules[\\/](recharts)[\\/]/.test(id)) {
                return 'vendor-ui';
              }

              return undefined;
            },
          },
        },
        chunkSizeWarningLimit: 1000,
      },
      // Optimize dependencies
      optimizeDeps: {
        include: ['react', 'react-dom', 'recharts'],
      },
    };
});
