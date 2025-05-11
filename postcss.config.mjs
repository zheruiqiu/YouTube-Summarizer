/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {
      config: './tailwind.config.ts',
    },
  },
};

export default config;
