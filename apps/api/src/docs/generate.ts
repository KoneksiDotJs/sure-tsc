import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpenApiSpec } from './openapi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');
const outputDir = path.join(repoRoot, 'docs', 'api');
const outputPath = path.join(outputDir, 'openapi.json');

fs.mkdirSync(outputDir, { recursive: true });
const spec = getOpenApiSpec();
fs.writeFileSync(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

console.log(
  `Generated OpenAPI ${spec.openapi} spec (${Object.keys(spec.paths).length} paths, ${Object.keys(spec.components.schemas).length} schemas) -> ${outputPath}`
);
