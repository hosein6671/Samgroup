/**
 * Shared PostCSS configuration. An app re-exports it:
 *
 *   export { default } from "@sam-group/config/postcss";
 *
 * Tailwind v4 needs no autoprefixer — vendor prefixing is handled internally by Lightning CSS,
 * and adding autoprefixer alongside it duplicates work and can fight the output.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
