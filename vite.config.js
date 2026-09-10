import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths -- the Electron build loads the built index.html
  // straight off disk via file://, where Vite's default absolute "/assets/…"
  // paths don't resolve. Harmless for the regular web build (still served
  // from a normal origin).
  base: './',
});
