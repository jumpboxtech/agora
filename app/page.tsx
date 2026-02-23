import type { Metadata } from 'next';
import ClientPage from '../app/components/ClientPage';

const APP_URL = 'https://agora.jumpbox.tech';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;

  // If stats params exist, use dynamic OG image; otherwise use static frame-preview
  const hasStats = params.tier || params.earned;
  const ogQuery = hasStats
    ? `?tier=${params.tier || '0'}&earned=${params.earned || '0'}&apis=${params.apis || '0'}&agents=${params.agents || '0'}&agora=${params.agora || '0'}&processed=${params.processed || '0'}`
    : '';
  const imageUrl = hasStats
    ? `${APP_URL}/api/og${ogQuery}`
    : `${APP_URL}/images/frame-preview.png`;

  const miniappMetadata = {
    version: 'next',
    name: 'Agora',
    iconUrl: `${APP_URL}/images/agora-icon.png`,
    splashImageUrl: `${APP_URL}/images/agora-splash.png`,
    splashBackgroundColor: '#0a0a12',
    homeUrl: APP_URL,
  };

  const frameMetadata = {
    version: 'next',
    imageUrl,
    button: {
      title: 'Play Agora',
      action: {
        type: 'launch_frame',
        name: 'Agora',
        url: APP_URL,
        splashImageUrl: `${APP_URL}/images/agora-splash.png`,
        splashBackgroundColor: '#0a0a12',
      },
    },
  };

  return {
    openGraph: {
      title: 'Agora — x402 Infrastructure Tycoon',
      description: 'Build autonomous x402 payment infrastructure. Deploy APIs, hire AI agents, stake $AGORA.',
      images: [imageUrl],
      url: APP_URL,
    },
    other: {
      'fc:miniapp': JSON.stringify(miniappMetadata),
      'fc:frame': JSON.stringify(frameMetadata),
    },
  };
}

export default function Home() {
  return <ClientPage />;
}
