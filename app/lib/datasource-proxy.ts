import type { DecryptedDataSource } from './datasource-store';

const TIMEOUT_MS = 5_000;
const MAX_BODY = 1_048_576; // 1MB
const MAX_ROWS = 1_000;

interface ProxyResult {
  data: unknown;
  status: number;
}

export async function proxyDataSource(source: DecryptedDataSource): Promise<ProxyResult> {
  try {
    switch (source.type) {
      case 'url':
        return await proxyUrl(source.url!);
      case 'api':
        return await proxyApi(source.url!, source.headers || {});
      case 'db':
        return await proxyDb(source.dbType!, source.dbConnectionString!, source.dbQuery!);
      default:
        return { data: { error: `Unknown source type: ${source.type}` }, status: 400 };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream error';
    console.error('[datasource-proxy]', source.type, source.path, message);
    return { data: { error: message }, status: 502 };
  }
}

async function proxyUrl(url: string): Promise<ProxyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    if (text.length > MAX_BODY) {
      return { data: { error: 'Response exceeds 1MB limit' }, status: 502 };
    }
    try {
      return { data: JSON.parse(text), status: 200 };
    } catch {
      return { data: { raw: text.slice(0, 10_000) }, status: 200 };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function proxyApi(url: string, headers: Record<string, string>): Promise<ProxyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    if (text.length > MAX_BODY) {
      return { data: { error: 'Response exceeds 1MB limit' }, status: 502 };
    }
    try {
      return { data: JSON.parse(text), status: res.ok ? 200 : res.status };
    } catch {
      return { data: { raw: text.slice(0, 10_000) }, status: res.ok ? 200 : res.status };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function proxyDb(
  dbType: 'postgres' | 'mysql',
  connectionString: string,
  query: string,
): Promise<ProxyResult> {
  // Validate query is read-only
  const trimmed = query.trim();
  if (!/^SELECT\b/i.test(trimmed)) {
    return { data: { error: 'Only SELECT queries are allowed' }, status: 400 };
  }

  if (dbType === 'postgres') {
    return await queryPostgres(connectionString, trimmed);
  } else {
    return await queryMysql(connectionString, trimmed);
  }
}

async function queryPostgres(connectionString: string, query: string): Promise<ProxyResult> {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: TIMEOUT_MS,
    query_timeout: TIMEOUT_MS,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    const result = await client.query(query);
    const rows = result.rows.slice(0, MAX_ROWS);
    return { data: { rows, count: rows.length, truncated: result.rows.length > MAX_ROWS }, status: 200 };
  } finally {
    await client.end().catch(() => {});
  }
}

async function queryMysql(connectionString: string, query: string): Promise<ProxyResult> {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection({
    uri: connectionString,
    connectTimeout: TIMEOUT_MS,
  });

  try {
    const [rows] = await connection.execute({ sql: query, timeout: TIMEOUT_MS });
    const arr = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
    return { data: { rows: arr, count: arr.length, truncated: Array.isArray(rows) && rows.length > MAX_ROWS }, status: 200 };
  } finally {
    await connection.end().catch(() => {});
  }
}
