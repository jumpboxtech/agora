import { getRedis, datasourceKey } from './redis';
import { encrypt, decrypt } from './crypto';
import { randomBytes } from 'crypto';

export interface DataSource {
  id: string;
  type: 'api' | 'url' | 'db';
  name: string;
  path: string;
  price: string;
  createdAt: number;
  url?: string;
  headers?: string;           // encrypted JSON
  dbConnectionString?: string; // encrypted
  dbQuery?: string;
  dbType?: 'postgres' | 'mysql';
}

export interface DecryptedDataSource extends Omit<DataSource, 'headers' | 'dbConnectionString'> {
  headers?: Record<string, string>;
  dbConnectionString?: string;
}

const PATH_REGEX = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/;

function generateId(): string {
  return `src_${randomBytes(6).toString('hex')}`;
}

async function readAll(address: string): Promise<DataSource[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = await redis.get<string>(datasourceKey(address));
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as DataSource[]);
}

async function writeAll(address: string, sources: DataSource[]): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error('Redis not available');
  await redis.set(datasourceKey(address), JSON.stringify(sources));
}

/** List sources with secrets redacted */
export async function listSources(address: string): Promise<DataSource[]> {
  const sources = await readAll(address);
  return sources.map(redact);
}

export async function getSource(address: string, sourceId: string): Promise<DataSource | null> {
  const sources = await readAll(address);
  return sources.find((s) => s.id === sourceId) || null;
}

export async function getSourceByPath(address: string, path: string): Promise<DataSource | null> {
  const sources = await readAll(address);
  return sources.find((s) => s.path === path) || null;
}

export async function createSource(
  address: string,
  input: {
    type: DataSource['type'];
    name: string;
    path: string;
    price: string;
    url?: string;
    headers?: Record<string, string>;
    dbConnectionString?: string;
    dbQuery?: string;
    dbType?: 'postgres' | 'mysql';
  },
): Promise<DataSource> {
  if (!PATH_REGEX.test(input.path)) {
    throw new Error('Path must be 2-30 chars, lowercase alphanumeric + hyphens');
  }

  const sources = await readAll(address);
  if (sources.find((s) => s.path === input.path)) {
    throw new Error('Path already in use');
  }
  if (sources.length >= 20) {
    throw new Error('Maximum 20 data sources per agent');
  }

  const source: DataSource = {
    id: generateId(),
    type: input.type,
    name: input.name.slice(0, 64),
    path: input.path,
    price: input.price,
    createdAt: Date.now(),
    url: input.url,
    headers: input.headers ? encrypt(JSON.stringify(input.headers)) : undefined,
    dbConnectionString: input.dbConnectionString ? encrypt(input.dbConnectionString) : undefined,
    dbQuery: input.dbQuery,
    dbType: input.dbType,
  };

  sources.push(source);
  await writeAll(address, sources);
  return redact(source);
}

export async function updateSource(
  address: string,
  sourceId: string,
  patch: Partial<{
    name: string;
    price: string;
    url: string;
    headers: Record<string, string>;
    dbConnectionString: string;
    dbQuery: string;
  }>,
): Promise<DataSource | null> {
  const sources = await readAll(address);
  const idx = sources.findIndex((s) => s.id === sourceId);
  if (idx === -1) return null;

  const s = sources[idx];
  if (patch.name !== undefined) s.name = patch.name.slice(0, 64);
  if (patch.price !== undefined) s.price = patch.price;
  if (patch.url !== undefined) s.url = patch.url;
  if (patch.headers !== undefined) s.headers = encrypt(JSON.stringify(patch.headers));
  if (patch.dbConnectionString !== undefined) s.dbConnectionString = encrypt(patch.dbConnectionString);
  if (patch.dbQuery !== undefined) s.dbQuery = patch.dbQuery;

  sources[idx] = s;
  await writeAll(address, sources);
  return redact(s);
}

export async function deleteSource(address: string, sourceId: string): Promise<boolean> {
  const sources = await readAll(address);
  const filtered = sources.filter((s) => s.id !== sourceId);
  if (filtered.length === sources.length) return false;
  await writeAll(address, filtered);
  return true;
}

/** Decrypt secrets for proxy use only */
export function decryptSecrets(source: DataSource): DecryptedDataSource {
  return {
    ...source,
    headers: source.headers ? JSON.parse(decrypt(source.headers)) : undefined,
    dbConnectionString: source.dbConnectionString ? decrypt(source.dbConnectionString) : undefined,
  };
}

/** Redact encrypted fields for API responses */
function redact(source: DataSource): DataSource {
  return {
    ...source,
    headers: source.headers ? '***' : undefined,
    dbConnectionString: source.dbConnectionString ? '***' : undefined,
  };
}
