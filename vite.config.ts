import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import type { ManifestV3Export } from '@crxjs/vite-plugin'
import path from 'path'
import fs from 'fs'
import { transformSync } from 'esbuild'

/**
 * Post-build fixes for CRXJS beta quirks:
 *
 * 1. use_dynamic_url:true — CRXJS marks content-script assets as dynamic-URL
 *    only, but the loader uses chrome.runtime.getURL() (static URL) to import
 *    them. Chrome denies the load. Fix: flip every use_dynamic_url to false.
 *
 * 2. bridge.ts extension — Chrome's chrome.scripting.executeScript only accepts
 *    .js files. CRXJS outputs the bridge as "src/injected/bridge.ts" (keeping
 *    the original extension). Fix: rename it to .js and patch every reference
 *    in the dist folder.
 */
function fixCrxjsQuirks(): Plugin {
  return {
    name: 'fix-crxjs-quirks',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')

      // ── 1. Compile bridge.ts → bridge.js ───────────────────────────────────
      // CRXJS copies web_accessible_resources verbatim (no TypeScript compilation).
      // chrome.scripting.executeScript also requires .js. We compile with esbuild.
      const srcBridgeTs = path.resolve(__dirname, 'src/injected/bridge.ts')
      const distBridgeTs = path.join(distDir, 'src/injected/bridge.ts')
      const bridgeJsPath = path.join(distDir, 'src/injected/bridge.js')
      if (fs.existsSync(srcBridgeTs)) {
        const { code } = transformSync(fs.readFileSync(srcBridgeTs, 'utf-8'), {
          loader: 'ts',
          target: 'chrome100',
          format: 'iife',
        })
        fs.mkdirSync(path.dirname(bridgeJsPath), { recursive: true })
        fs.writeFileSync(bridgeJsPath, code)
        // Remove the raw .ts copy that CRXJS placed in dist/
        if (fs.existsSync(distBridgeTs)) fs.unlinkSync(distBridgeTs)
      }

      // ── 2. Fix manifest.json ────────────────────────────────────────────────
      // a) Any remaining bridge.ts reference → bridge.js
      // b) use_dynamic_url: true → false (static chrome-extension:// URLs)
      const manifestPath = path.join(distDir, 'manifest.json')
      if (fs.existsSync(manifestPath)) {
        let raw = fs.readFileSync(manifestPath, 'utf-8')
        raw = raw.replace(/src\/injected\/bridge\.ts/g, 'src/injected/bridge.js')
        raw = raw.replace(/"use_dynamic_url":\s*true/g, '"use_dynamic_url": false')
        fs.writeFileSync(manifestPath, raw)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest as ManifestV3Export }),
    fixCrxjsQuirks(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Required for @anthropic-ai/sdk in service worker context
  define: {
    'process.env': '{}',
    'process.version': '"v18.0.0"',
  },
  build: {
    // Sourcemaps for easier debugging in Chrome DevTools
    sourcemap: true,
    minify: false,
  },
})
