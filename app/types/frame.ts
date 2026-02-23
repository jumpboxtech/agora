// types/frame.ts
export interface FrameContext {
    user: {
      fid: number;
      username: string;
      displayName: string;
      pfpUrl: string;
      location: {
        placeId: string;
        description: string;
      };
    };
    client: {
      clientFid: number;
      added: boolean;
    };
  }

  export interface FrameSDK {
    context: Promise<FrameContext>;
    actions: {
      ready: () => void;
      openUrl: (url: string) => void;
      close: () => void;
      addMiniApp: () => Promise<void>;
      composeCast: (opts: { message: string; embeds?: string[] }) => Promise<{ cast: { hash: string; channelKey?: string } | null }>;
      viewProfile: (opts: { fid: number }) => Promise<void>;
      swapToken: (opts: { sellToken: string; buyToken: string; sellAmount?: string }) => Promise<unknown>;
    };
  }

  declare global {
    interface Window {
      frame: {
        sdk: FrameSDK;
      };
    }
  }
