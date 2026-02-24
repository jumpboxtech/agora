import { NextRequest, NextResponse } from 'next/server';
import { generateAgentTemplate, createAgentRepo, type AgentConfig } from '../../../lib/github';
import { resolveAgent } from '../../../lib/agent-resolver';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { githubToken, repoName, agentName, endpoints } = await request.json();

    if (!githubToken || !repoName || !agentName) {
      return NextResponse.json(
        { error: 'githubToken, repoName, and agentName required' },
        { status: 400 },
      );
    }

    // Resolve agent to get payTo address
    const agent = await resolveAgent(agentName);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Default endpoints if none specified
    const selectedEndpoints = endpoints?.length > 0
      ? endpoints
      : [
          { path: 'api/v1/curves', price: '$0.01', description: 'Bonding curve data' },
          { path: 'api/v1/signals', price: '$0.02', description: 'Agent signals and metrics' },
          { path: 'api/v1/directory', price: '$0.01', description: 'Agent directory listing' },
        ];

    const config: AgentConfig = {
      name: agent.name || agentName,
      payTo: agent.payTo,
      endpoints: selectedEndpoints,
    };

    const files = generateAgentTemplate(config);
    const repo = await createAgentRepo(githubToken, repoName, files);

    return NextResponse.json({
      success: true,
      repoUrl: repo.url,
      cloneUrl: repo.cloneUrl,
      filesCreated: files.length,
      endpoints: selectedEndpoints.length,
    });
  } catch (err) {
    console.error('[agents/export] error:', err);

    const status = (err as { status?: number })?.status;
    if (status === 401) {
      return NextResponse.json({ error: 'Invalid GitHub token' }, { status: 401 });
    }
    if (status === 422) {
      return NextResponse.json({ error: 'Repository name already exists' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 });
  }
}
