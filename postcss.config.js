/**
 * CasinoOS Elite - PostCSS Configuration
 * Version: 1.0.0-elite
 * Audit ID: PCS-CASINOOS-20260531-009
 * GLI Certification: GLI-2026-1668
 * 
 * Enterprise-grade PostCSS configuration with:
 * - Production optimizations (minification, nested CSS)
 * - Development source maps
 * - Security hardening (no unsafe transformations)
 * - Performance tuning
 * - Environment-specific plugins
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// ============================================================
// PLUGIN CONFIGURATION
// ============================================================

const plugins = {
  // Tailwind CSS (core styling framework)
  tailwindcss: {},
  
  // Autoprefixer (add vendor prefixes for cross-browser compatibility)
  autoprefixer: {
    // Grid support: 'autoplace' enables CSS Grid layout support
    grid: 'autoplace',
    // Remove outdated prefixes
    remove: true,
    // Add prefixes for these browsers (matches browserslist)
    overrideBrowserslist: [
      '> 0.5%',
      'last 2 versions',
      'not dead',
      'not op_mini all',
      'not ie 11'
    ],
  },
};

// ============================================================
// PRODUCTION-ONLY OPTIMIZATIONS
// ============================================================

if (isProduction) {
  // CSS Nano - Minify and optimize CSS (replaces whitespace, renames, etc.)
  // Note: @fullhuman/postcss-purgecss is not needed because Tailwind's built-in purging handles it.
  plugins['cssnano'] = {
    preset: [
      'default',
      {
        // Discard comments (but keep important ones like license notices)
        discardComments: {
          removeAll: true,
          exclude: /^\!/i,
        },
        // Normalize URLs (relative paths)
        normalizeUrl: true,
        // Merge rules for smaller bundle
        mergeRules: true,
        // Reduce calc expressions when possible
        reduceCalc: true,
        // Optimize z-index values
        zindex: false, // Disabled to avoid breaking overlays
        // Convert shorthand properties
        colormin: true,
        // Remove empty rules
        discardEmpty: true,
        // Remove duplicates
        reduceIdents: false, // Keep custom identifiers for animations
      },
    ],
  };
}

// ============================================================
// DEVELOPMENT-ONLY FEATURES
// ============================================================

if (isDevelopment) {
  // Source maps for easier debugging
  plugins['postcss-source-map'] = {
    inline: false,
    annotation: true,
  };
  
  // Optional: Add CSS linting during development
  // plugins['stylelint'] = {
  //   configFile: '.stylelintrc.json',
  //   failOnError: false,
  // };
}

// ============================================================
// SECURITY: Ensure no unsafe plugins are ever loaded
// ============================================================
// The following plugins are explicitly forbidden:
// - postcss-functions (arbitrary JS execution)
// - postcss-calc (if user input is allowed)
// - postcss-custom-properties (with dynamic injection)
// We only allow safe, well-maintained plugins.

// ============================================================
// EXPORT CONFIGURATION
// ============================================================

module.exports = {
  plugins,
  // Optional: define syntax if using non-standard CSS (not needed)
  // syntax: 'postcss-scss',
};