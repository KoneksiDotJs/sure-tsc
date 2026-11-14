import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getOpenApiSpec, renderApiDocsHtml } from './openapi.js';

function collectRefs(node: unknown, refs: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRefs(item, refs);
    }
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === '$ref' && typeof value === 'string') {
        refs.add(value);
      } else {
        collectRefs(value, refs);
      }
    }
  }
}

describe('OpenAPI 3.0.3 Documentation & Explorer', () => {
  it('generates a valid OpenAPI 3.0.3 document with zero dangling schema $refs', () => {
    const spec = getOpenApiSpec();

    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('Sure');
    expect(spec.components.securitySchemes).toHaveProperty('bearerAuth');
    expect(spec.components.securitySchemes).toHaveProperty('cookieAuth');

    const refs = new Set<string>();
    collectRefs(spec.paths, refs);
    collectRefs(spec.components.schemas, refs);

    expect(refs.size).toBeGreaterThan(20);
    for (const refPath of refs) {
      expect(refPath.startsWith('#/components/schemas/')).toBe(true);
      const schemaName = refPath.replace('#/components/schemas/', '');
      expect(spec.components.schemas).toHaveProperty(schemaName);
    }
  });

  it('documents all key REST v1 and MCP routes with unique operationIds', () => {
    const spec = getOpenApiSpec();
    const expectedPaths = [
      '/api/v1/health',
      '/api/v1/version',
      '/api/v1/openapi.json',
      '/api/docs',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/accounts',
      '/api/v1/accounts/{id}/loan-simulation',
      '/api/v1/entries',
      '/api/v1/entries/transfers',
      '/api/v1/entries/{id}/split',
      '/api/v1/imports/commit',
      '/api/v1/rules',
      '/api/v1/budgets/{month}',
      '/api/v1/goals',
      '/api/v1/goals/{id}',
      '/api/v1/reports',
      '/api/v1/sync/run',
      '/api/v1/ai/chat',
      '/api/v1/mcp',
      '/mcp',
    ];

    for (const endpoint of expectedPaths) {
      expect(spec.paths).toHaveProperty(endpoint);
    }

    const seenOperationIds = new Set<string>();
    for (const methods of Object.values(spec.paths)) {
      for (const operation of Object.values(methods)) {
        expect(operation.operationId).toBeTruthy();
        expect(seenOperationIds.has(operation.operationId)).toBe(false);
        seenOperationIds.add(operation.operationId);
      }
    }
  });

  it('matches the checked-in docs/api/openapi.json artifact on disk', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const specPath = path.resolve(__dirname, '../../../..', 'docs', 'api', 'openapi.json');

    expect(fs.existsSync(specPath)).toBe(true);
    const diskSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    expect(diskSpec).toEqual(getOpenApiSpec());
  });

  it('serves /api/v1/openapi.json and /api/docs over HTTP without requiring authentication', async () => {
    const app = createApp();

    const jsonRes = await request(app).get('/api/v1/openapi.json');
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers['content-type']).toContain('application/json');
    expect(jsonRes.body.openapi).toBe('3.0.3');

    const docsRes = await request(app).get('/api/docs');
    expect(docsRes.status).toBe(200);
    expect(docsRes.headers['content-type']).toContain('text/html');
    expect(docsRes.text).toContain('Sure REST &amp; MCP API Explorer');
    expect(docsRes.text).toContain('/api/v1/openapi.json');
    expect(renderApiDocsHtml().length).toBeGreaterThan(500);
  });
});
