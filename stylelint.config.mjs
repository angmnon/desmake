/** @type {import('stylelint').Config} */
export default {
  extends: 'stylelint-config-standard',
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'layer', 'theme', 'custom-variant'],
      },
    ],
    'hue-degree-notation': null,
    'import-notation': null,
    'lightness-notation': null,
    'rule-empty-line-before': null,
    'value-keyword-case': null,

    // globals.css is a hand-written utility layer: single-purpose classes such as
    // `.small { font-size: .8125rem; line-height: 1.5; }` are deliberately written
    // on one line so the whole scale can be scanned at a glance. Enforcing one
    // declaration per line would triple the file for zero readability gain.
    'declaration-block-single-line-max-declarations': null,

    // -webkit-text-size-adjust is still required by iOS Safari and
    // -webkit-backdrop-filter by Safari < 18; the unprefixed properties are not
    // supported there. Both are declared alongside their standard counterparts.
    'property-no-vendor-prefix': [true, { ignoreProperties: ['text-size-adjust', 'backdrop-filter'] }],
  },
};
