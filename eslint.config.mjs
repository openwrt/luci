import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import markdown from "@eslint/markdown";
import jsdoc from 'eslint-plugin-jsdoc';
import json from '@eslint/json';
import js from '@eslint/js';

console.log("loaded luci repo eslint.config.mjs");

export const jsdoc_less_relaxed_rules = {
 	// 0: off, 1: warn, 2: error
	/* --- JSDoc correctness --- */
	'jsdoc/check-alignment': 'warn',
	'jsdoc/check-param-names': 'off',
	'jsdoc/check-tag-names': 'warn',
	'jsdoc/check-types': 'off',
	'jsdoc/no-defaults': 'off',
	'jsdoc/reject-any-type': 'off',
	'jsdoc/require-jsdoc': 'off',
	'jsdoc/require-param': 'warn',
	'jsdoc/require-returns': 'warn',
	'jsdoc/require-returns-check': 'off',
	'jsdoc/require-returns-type': 'warn',
	'jsdoc/tag-lines': 'off',
	'no-shadow-restricted-names': 'off',

	/* --- Style --- */
	'jsdoc/require-description': 'off',
	'jsdoc/require-param-description': 'off',
	'jsdoc/require-returns-description': 'off',

	/* --- custom classes and types --- */
	'jsdoc/no-undefined-types': 'warn', // custom LuCI types
	'jsdoc/valid-types': 'warn',
}

export const jsdoc_relaxed_rules = {
 	// 0: off, 1: warn, 2: error
	/* --- JSDoc correctness --- */
	'jsdoc/check-alignment': 'warn',
	'jsdoc/check-param-names': 'off',
	'jsdoc/check-tag-names': 'warn',
	'jsdoc/check-types': 'off',
	'jsdoc/no-defaults': 'off',
	'jsdoc/reject-any-type': 'off',
	'jsdoc/require-jsdoc': 'off',
	'jsdoc/require-param': 'warn',
	'jsdoc/require-returns': 'warn',
	'jsdoc/require-returns-check': 'off',
	'jsdoc/require-returns-type': 'warn',
	'jsdoc/tag-lines': 'off',
	'no-shadow-restricted-names': 'off',

	/* --- Style --- */
	'jsdoc/require-description': 'off',
	'jsdoc/require-param-description': 'off',
	'jsdoc/require-returns-description': 'off',

	/* --- custom classes and types --- */
	'jsdoc/no-undefined-types': 'off', // custom LuCI types
	'jsdoc/valid-types': 'off',
}

export default defineConfig([
	globalIgnores([
		'docs',
		'node_modules',
	]),
	// Markdown
	{
		files: ["**/*.md"],
		plugins: {
			markdown,
		},
		processor: "markdown/markdown",
	},
	// applies only to JavaScript blocks inside of Markdown files
	{
		files: ["**/*.md/*.js"],
		rules: {
			strict: "off",
		},
	},
	// JSON files
	{
		files: ['**/*.json'],
		ignores: ['package-lock.json'],
		plugins: { json },
		language: 'json/json',
		extends: ['json/recommended'],
		rules: {
			'json/no-duplicate-keys': 'error',
		},
	},
	// JavaScript files
	{
		files: ['**/*.js'],
		language: '@/js',
		plugins: { js },
		extends: ['js/recommended'],
		linterOptions:{
			// silence warnings about inert // eslint-disable-next-line xxx
			reportUnusedDisableDirectives: "off",
		},
		languageOptions: {
			sourceType: 'script',
			ecmaVersion: 2026, // 2015 == ECMA6
			globals: {
				...globals.browser,
				/* LuCI runtime / cbi exports */
				_: 'readonly',
				N_: 'readonly',
				L: 'readonly',
				E: 'readonly',
				TR: 'readonly',
				cbi_d: 'readonly',
				cbi_strings: 'readonly',
				cbi_d_add: 'readonly',
				cbi_d_check: 'readonly',
				cbi_d_checkvalue: 'readonly',
				cbi_d_update: 'readonly',
				cbi_init: 'readonly',
				cbi_update_table: 'readonly',
				cbi_validate_form: 'readonly',
				cbi_validate_field: 'readonly',
				cbi_validate_named_section_add: 'readonly',
				cbi_validate_reset: 'readonly',
				cbi_row_swap: 'readonly',
				cbi_tag_last: 'readonly',
				cbi_submit: 'readonly',
				cbi_dropdown_init: 'readonly',
				isElem: 'readonly',
				toElem: 'readonly',
				matchesElem: 'readonly',
				findParent: 'readonly',
				sfh: 'readonly',
				renderBadge: 'readonly', // found in theme templates
				/* modules */
				baseclass: 'readonly',
				dom: 'readonly',
				firewall: 'readonly',
				fwtool: 'readonly',
				form: 'readonly',
				fs: 'readonly',
				network: 'readonly',
				nettools: 'readonly',
				poll: 'readonly',
				random: 'readonly',
				request: 'readonly',
				session: 'readonly',
				rpc: 'readonly',
				uci: 'readonly',
				ui: 'readonly',
				uqr: 'readonly',
				validation: 'readonly',
				view: 'readonly',
				widgets: 'readonly',
				/* dockerman */
				dm2: 'readonly',
				jsapi: 'readonly',
			},
			parserOptions: {
				ecmaFeatures: {
					globalReturn: true,
				}
			},
		},
		rules: { // 0: off, 1: warn, 2: error
			'strict': 0,
			'no-prototype-builtins': 0,
			'no-empty': 0,
			'no-undef': 'warn',
			'no-unused-vars': ['off', { "caughtErrors": "none" }],
			'no-regex-spaces': 0,
			'no-control-regex': 0,
		}
	},
	{
		extends: ['jsdoc/recommended'],       // run jsdoc recommended rules
		files: ['modules/luci-base/**/*.js'], // ... but only on these js files
		plugins: { jsdoc },
		rules: {
			/* use these settings when linting the checked out repo */
			// ...jsdoc_less_relaxed_rules
			/* ... and use these settings for the repo (less noisy) */
			...jsdoc_relaxed_rules
		},
	}
]);
