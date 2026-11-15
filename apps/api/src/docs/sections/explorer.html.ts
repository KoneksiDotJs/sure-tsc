export function renderApiDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sure API Explorer (OpenAPI 3.0.3)</title>
  <style>
    :root {
      --bg: #fafafa;
      --surface: #ffffff;
      --surface-alt: #f5f5f5;
      --border: #e5e5e5;
      --text: #171717;
      --muted: #737373;
      --accent: #09090b;
      --get: #15803d;
      --post: #1d4ed8;
      --patch: #b45309;
      --put: #6d28d9;
      --delete: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 20px 24px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .header-inner {
      max-width: 1120px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
    }
    .title h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .title p { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    input[type="text"], input[type="password"] {
      border: 1px solid var(--border);
      background: var(--surface);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 13px;
      min-width: 220px;
    }
    button {
      border: 1px solid var(--border);
      background: var(--accent);
      color: #fff;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    button.secondary {
      background: var(--surface);
      color: var(--text);
    }
    main { max-width: 1120px; margin: 24px auto; padding: 0 24px 64px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .tag-btn {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
    }
    .tag-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .op-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .op-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
    }
    .method {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 6px;
      color: #fff;
      min-width: 64px;
      text-align: center;
    }
    .method.get { background: var(--get); }
    .method.post { background: var(--post); }
    .method.patch { background: var(--patch); }
    .method.put { background: var(--put); }
    .method.delete { background: var(--delete); }
    .op-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 600; }
    .op-summary { font-size: 13px; color: var(--muted); margin-left: auto; }
    .op-body {
      border-top: 1px solid var(--border);
      background: var(--surface-alt);
      padding: 16px;
      display: none;
    }
    .op-body.open { display: block; }
    pre, textarea {
      width: 100%;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      background: #111827;
      color: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #374151;
      overflow-x: auto;
    }
    textarea { min-height: 120px; resize: vertical; }
    .section-label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin: 12px 0 6px; }
    .param-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; font-size: 13px; }
    .param-row label { min-width: 160px; font-family: ui-monospace, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="title">
        <h1>Sure REST &amp; MCP API Explorer</h1>
        <p id="spec-meta">Loading OpenAPI 3.0.3 specification...</p>
      </div>
      <div class="controls">
        <input id="search-input" type="text" placeholder="Filter by path or summary..." />
        <input id="token-input" type="password" placeholder="Bearer JWT or sk_live_... key" />
        <button id="save-token-btn" class="secondary" type="button">Use Token</button>
        <a href="/api/v1/openapi.json" target="_blank"><button class="secondary" type="button">openapi.json</button></a>
      </div>
    </div>
  </header>
  <main>
    <div id="tags" class="tags"></div>
    <div id="operations"></div>
  </main>
  <script>
    (function () {
      let spec = null;
      let activeTag = 'ALL';
      let token = sessionStorage.getItem('sure_docs_token') || '';
      const tokenInput = document.getElementById('token-input');
      const searchInput = document.getElementById('search-input');
      tokenInput.value = token;

      document.getElementById('save-token-btn').addEventListener('click', function () {
        token = tokenInput.value.trim();
        sessionStorage.setItem('sure_docs_token', token);
      });

      function resolveSchema(schema, depth) {
        if (!schema || depth > 5) return schema || {};
        if (schema.$ref && spec && spec.components && spec.components.schemas) {
          const name = schema.$ref.replace('#/components/schemas/', '');
          return resolveSchema(spec.components.schemas[name], depth + 1);
        }
        return schema;
      }

      function sampleFromSchema(schema, depth) {
        const s = resolveSchema(schema, depth || 0);
        if (!s) return {};
        if (s.default !== undefined) return s.default;
        if (s.enum && s.enum.length) return s.enum[0];
        if (s.example !== undefined) return s.example;
        if (s.oneOf && s.oneOf.length) return sampleFromSchema(s.oneOf[0], (depth || 0) + 1);
        if (s.type === 'object' && s.properties) {
          const out = {};
          for (const [k, v] of Object.entries(s.properties)) {
            out[k] = sampleFromSchema(v, (depth || 0) + 1);
          }
          return out;
        }
        if (s.type === 'array') return [sampleFromSchema(s.items, (depth || 0) + 1)];
        if (s.type === 'boolean') return false;
        if (s.type === 'integer' || s.type === 'number') return 1;
        if (s.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
        if (s.format === 'email') return 'user@example.com';
        return 'string';
      }

      function render() {
        if (!spec) return;
        const query = searchInput.value.trim().toLowerCase();
        const opsEl = document.getElementById('operations');
        opsEl.innerHTML = '';

        for (const [pathKey, methods] of Object.entries(spec.paths)) {
          for (const [method, op] of Object.entries(methods)) {
            const tags = op.tags || ['General'];
            if (activeTag !== 'ALL' && !tags.includes(activeTag)) continue;
            const hay = (method + ' ' + pathKey + ' ' + (op.summary || '')).toLowerCase();
            if (query && !hay.includes(query)) continue;

            const card = document.createElement('div');
            card.className = 'op-card';
            const header = document.createElement('div');
            header.className = 'op-header';
            header.innerHTML =
              '<span class="method ' + method + '">' + method + '</span>' +
              '<span class="op-path">' + pathKey + '</span>' +
              '<span class="op-summary">' + (op.summary || '') + '</span>';

            const body = document.createElement('div');
            body.className = 'op-body';

            const paramsHtml = (op.parameters || [])
              .map(function (p) {
                return '<div class="param-row"><label>' + p.name + ' (' + p.in + (p.required ? '*' : '') + ')</label>' +
                  '<input data-param-in="' + p.in + '" data-param-name="' + p.name + '" type="text" placeholder="' + (p.description || p.schema.type || '') + '" /></div>';
              })
              .join('');

            const reqSchema = op.requestBody && op.requestBody.content && op.requestBody.content['application/json']
              ? op.requestBody.content['application/json'].schema
              : null;

            const reqSample = reqSchema ? JSON.stringify(sampleFromSchema(reqSchema, 0), null, 2) : '';

            body.innerHTML =
              (op.description ? '<p>' + op.description + '</p>' : '') +
              (paramsHtml ? '<div class="section-label">Parameters</div>' + paramsHtml : '') +
              (reqSchema
                ? '<div class="section-label">Request Body (application/json)</div>' +
                  '<textarea class="req-body">' + reqSample + '</textarea>' +
                  '<div class="section-label">Schema</div><pre>' + JSON.stringify(resolveSchema(reqSchema, 0), null, 2) + '</pre>'
                : '') +
              '<div style="margin-top:12px;"><button type="button" class="send-btn">Send Request</button></div>' +
              '<div class="resp-wrap" style="display:none;"><div class="section-label resp-status"></div><pre class="resp-pre"></pre></div>';

            header.addEventListener('click', function () {
              body.classList.toggle('open');
            });

            body.querySelector('.send-btn').addEventListener('click', async function () {
              let targetUrl = pathKey;
              const qp = new URLSearchParams();
              body.querySelectorAll('input[data-param-name]').forEach(function (inp) {
                const val = inp.value.trim();
                const name = inp.getAttribute('data-param-name');
                if (inp.getAttribute('data-param-in') === 'path') {
                  targetUrl = targetUrl.replace('{' + name + '}', encodeURIComponent(val || '00000000-0000-0000-0000-000000000000'));
                } else if (val) {
                  qp.set(name, val);
                }
              });
              const qs = qp.toString();
              if (qs) targetUrl += '?' + qs;

              const headers = {};
              const activeToken = tokenInput.value.trim();
              if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
              const init = { method: method.toUpperCase(), credentials: 'include', headers };
              const ta = body.querySelector('.req-body');
              if (ta && ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
                headers['Content-Type'] = 'application/json';
                init.body = ta.value;
              }
              const started = performance.now();
              const res = await fetch(targetUrl, init);
              const elapsed = Math.round(performance.now() - started);
              const text = await res.text();
              let pretty = text;
              try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (_) {}
              const wrap = body.querySelector('.resp-wrap');
              wrap.style.display = 'block';
              body.querySelector('.resp-status').textContent = 'Response: HTTP ' + res.status + ' (' + elapsed + ' ms)';
              body.querySelector('.resp-pre').textContent = pretty;
            });

            card.appendChild(header);
            card.appendChild(body);
            opsEl.appendChild(card);
          }
        }
      }

      fetch('/api/v1/openapi.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          spec = data;
          document.getElementById('spec-meta').textContent =
            'OpenAPI ' + data.openapi + ' • ' + data.info.title + ' v' + data.info.version +
            ' • ' + Object.keys(data.paths).length + ' paths';
          const tagsEl = document.getElementById('tags');
          const tagNames = ['ALL'].concat((data.tags || []).map(function (t) { return t.name; }));
          tagNames.forEach(function (tag) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tag-btn' + (tag === activeTag ? ' active' : '');
            btn.textContent = tag;
            btn.addEventListener('click', function () {
              activeTag = tag;
              tagsEl.querySelectorAll('.tag-btn').forEach(function (b) { b.classList.remove('active'); });
              btn.classList.add('active');
              render();
            });
            tagsEl.appendChild(btn);
          });
          searchInput.addEventListener('input', render);
          render();
        });
    })();
  </script>
</body>
</html>`;
}
