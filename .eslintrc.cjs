module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    // MVP pragmatism: this repo currently uses `any` in multiple places.
    // Tighten later once the data model stabilizes.
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "react/no-unescaped-entities": "off"
  }
};
