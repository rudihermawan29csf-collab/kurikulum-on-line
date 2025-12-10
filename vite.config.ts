import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // process.cwd() diganti dengan '.' untuk menghindari error type Process yang tidak memiliki properti cwd
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    base: './', 
    define: {
      // Expose process.env.API_KEY to the client
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    }
  };
});