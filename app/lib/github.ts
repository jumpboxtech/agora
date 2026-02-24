import { Octokit } from 'octokit';

export type TemplateFile = { path: string; content: string };

export type AgentConfig = {
  name: string;
  payTo: string;
  endpoints: { path: string; price: string; description: string }[];
};

// ─── Template Generation ────────────────────────────────────────────────────

export function generateAgentTemplate(config: AgentConfig): TemplateFile[] {
  const files: TemplateFile[] = [];

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: `${config.name}-agent`,
      version: '1.0.0',
      description: `x402 API agent: ${config.name}`,
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      },
      dependencies: {
        '@coinbase/x402': '^0.1.0',
        '@x402/core': '^2.0.0',
        '@x402/evm': '^2.0.0',
        '@x402/next': '^2.0.0',
        next: '^15.3.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        viem: '^2.46.0',
      },
      devDependencies: {
        '@types/node': '^20',
        '@types/react': '^19',
        typescript: '^5',
      },
      engines: { node: '20.x' },
    }, null, 2),
  });

  // next.config.ts
  files.push({
    path: 'next.config.ts',
    content: `import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
`,
  });

  // tsconfig.json
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        paths: { '@/*': ['./*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
      exclude: ['node_modules'],
    }, null, 2),
  });

  // x402 server config
  files.push({
    path: 'app/lib/x402-server.ts',
    content: `import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { facilitator } from '@coinbase/x402';

const facilitatorClient = new HTTPFacilitatorClient(facilitator);
export const x402Server = new x402ResourceServer(facilitatorClient)
  .register('eip155:8453', new ExactEvmScheme());

export const AGENT_PAY_TO = '${config.payTo}';
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
`,
  });

  // Root layout
  files.push({
    path: 'app/layout.tsx',
    content: `export const metadata = { title: '${config.name} Agent API', description: 'x402-gated API endpoints' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
`,
  });

  // Landing page
  files.push({
    path: 'app/page.tsx',
    content: `export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '640px' }}>
      <h1>${config.name} Agent API</h1>
      <p>x402-gated endpoints powered by Agora.</p>
      <h2>Endpoints</h2>
      <ul>
${config.endpoints.map(e => `        <li><code>${e.path}</code> — ${e.price} USDC — ${e.description}</li>`).join('\n')}
      </ul>
      <p>Pay with x402 (USDC on Base) to access these endpoints.</p>
    </main>
  );
}
`,
  });

  // API routes
  for (const endpoint of config.endpoints) {
    const routePath = endpoint.path.replace(/^\//, '');
    files.push({
      path: `app/${routePath}/route.ts`,
      content: `import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { x402Server, AGENT_PAY_TO, USDC_BASE } from '${getRelativeImport(routePath)}lib/x402-server';

export const runtime = 'nodejs';

const handler = async (request: NextRequest): Promise<NextResponse<unknown>> => {
  // TODO: Add your endpoint logic here
  return NextResponse.json({
    endpoint: '${endpoint.path}',
    message: 'Payment verified. Replace this with your data.',
    timestamp: Date.now(),
  });
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: 'exact',
      price: '${endpoint.price}',
      network: 'eip155:8453',
      resource: USDC_BASE,
      payTo: AGENT_PAY_TO,
    },
    description: '${endpoint.description}',
  },
  x402Server,
);
`,
    });
  }

  // .env.example
  files.push({
    path: '.env.example',
    content: `# x402 Facilitator (Coinbase Developer Platform)
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=

# Optional: Override Base RPC
# BASE_RPC_URL=https://mainnet.base.org
`,
  });

  // README
  files.push({
    path: 'README.md',
    content: `# ${config.name} Agent API

x402-gated API agent deployed on Base mainnet via [Agora](https://agora.jumpbox.tech).

## Setup

1. \`npm install\`
2. Copy \`.env.example\` to \`.env.local\` and fill in your CDP API keys
3. \`npm run dev\`

## Endpoints

${config.endpoints.map(e => `- \`${e.path}\` — ${e.price} USDC — ${e.description}`).join('\n')}

## Deploy

Deploy to Vercel:

\`\`\`bash
npx vercel build --prod && npx vercel deploy --prebuilt --prod
\`\`\`

## How x402 Works

Clients send a regular HTTP request. If they haven't paid, they get a \`402 Payment Required\` response with payment instructions. After paying (USDC on Base), they re-send the request with a payment proof header, and the endpoint returns the data.

Built with [Agora](https://agora.jumpbox.tech) on [Jumpbox](https://jumpbox.tech).
`,
  });

  return files;
}

function getRelativeImport(routePath: string): string {
  const depth = routePath.split('/').length;
  return '../'.repeat(depth);
}

// ─── GitHub Repo Creation ───────────────────────────────────────────────────

export async function createAgentRepo(
  githubToken: string,
  repoName: string,
  files: TemplateFile[],
): Promise<{ url: string; cloneUrl: string }> {
  const octokit = new Octokit({ auth: githubToken });

  // Create repo
  const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
    name: repoName,
    description: 'x402 API agent powered by Agora',
    private: false,
    auto_init: true,
  });

  // Wait for init
  await new Promise(r => setTimeout(r, 2000));

  // Get default branch ref
  const { data: ref } = await octokit.rest.git.getRef({
    owner: repo.owner.login,
    repo: repo.name,
    ref: `heads/${repo.default_branch}`,
  });

  const baseCommitSha = ref.object.sha;

  // Get base tree
  const { data: baseCommit } = await octokit.rest.git.getCommit({
    owner: repo.owner.login,
    repo: repo.name,
    commit_sha: baseCommitSha,
  });

  // Create blobs for all files
  const blobs = await Promise.all(
    files.map(async (file) => {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner: repo.owner.login,
        repo: repo.name,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64',
      });
      return { path: file.path, sha: blob.sha, mode: '100644' as const, type: 'blob' as const };
    }),
  );

  // Create tree
  const { data: tree } = await octokit.rest.git.createTree({
    owner: repo.owner.login,
    repo: repo.name,
    base_tree: baseCommit.tree.sha,
    tree: blobs,
  });

  // Create commit
  const { data: commit } = await octokit.rest.git.createCommit({
    owner: repo.owner.login,
    repo: repo.name,
    message: 'Initial agent setup via Agora',
    tree: tree.sha,
    parents: [baseCommitSha],
  });

  // Update ref
  await octokit.rest.git.updateRef({
    owner: repo.owner.login,
    repo: repo.name,
    ref: `heads/${repo.default_branch}`,
    sha: commit.sha,
  });

  return {
    url: repo.html_url,
    cloneUrl: repo.clone_url,
  };
}
