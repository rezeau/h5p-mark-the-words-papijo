export default [
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        H5P: "readonly",
        H5PIntegration: "readonly",
        H5PEditor: "readonly"
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    },
    rules: {
      "no-var": "error",
      "semi": ["error", "always"],
      "indent": ["error", 2, { SwitchCase: 1 }],
      "brace-style": ["error", "stroustrup"],
      "keyword-spacing": ["error", { after: true }],
      "comma-spacing": ["error", { before: false, after: true }],
      "space-infix-ops": ["error", { int32Hint: false }],
      "eqeqeq": ["error", "smart"],
      "space-before-blocks": "error",
      "space-before-function-paren": ["error", {
        anonymous: "always",
        named: "never",
        asyncArrow: "always"
      }],
      "no-extra-boolean-cast": "off",
      "no-console": ["error", { allow: ["warn", "error"] }]
    }
  }
];