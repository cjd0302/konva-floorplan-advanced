import globals from 'globals'
import js from '@eslint/js'

export default [
  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,

        // ✅ 사내 WebView 전역
        M: 'readonly'
      }
    }
  }
]
