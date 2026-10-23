import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { getSiteOrigin, OG_IMAGE_PATH } from './src/components/seo/metadata.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_SITE_URL')
  const siteUrl = env.VITE_SITE_URL?.trim()
  const siteOrigin = getSiteOrigin(siteUrl)
  if (siteUrl && !siteOrigin) throw new Error('VITE_SITE_URL must be an absolute HTTP(S) site URL.')

  return {
    define: {
      'import.meta.env.VITE_SITE_URL': JSON.stringify(siteOrigin ?? ''),
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      {
        name: 'social-image-origin',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            if (!siteOrigin) return html

            const image = `${siteOrigin}${OG_IMAGE_PATH}`.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
            return {
              html: html.replaceAll(`content="${OG_IMAGE_PATH}"`, `content="${image}"`),
              tags: [
                { tag: 'meta', attrs: { property: 'og:url', content: `${siteOrigin}/`, 'data-seo-static': true }, injectTo: 'head' },
                { tag: 'link', attrs: { rel: 'canonical', href: `${siteOrigin}/`, 'data-seo-static': true }, injectTo: 'head' },
              ],
            }
          },
        },
      },
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/media': {
          target: 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media/, ''),
        },
      },
    },
  }
})
