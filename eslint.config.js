const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
    expoConfig,
    {
        ignores: ['dist/**'],
    },
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        rules: {
            'react-hooks/immutability': 'off',
            'react-hooks/refs': 'off',
            'react-hooks/purity': 'error',
            'react-hooks/set-state-in-effect': 'error',
        },
    },
]);
