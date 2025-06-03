import { defineConfig } from "eslint/config";
import json from "@eslint/json";

export default defineConfig([
	{
		files: ["**/*.json"],
		ignores: ["package-lock.json"],
		plugins: { json },
		language: "json/json",
		extends: ["json/recommended"],
	},
]);

