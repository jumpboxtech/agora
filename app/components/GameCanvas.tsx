'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Application } from 'pixi.js';
import type { GameState } from '../lib/engine';
import { GridBackground } from './pixi/GridBackground';
import { ProcessorNode } from './pixi/ProcessorNode';
import { DataStream } from './pixi/DataStream';
import { ApiNodes } from './pixi/ApiNode';
import { AgentSprites } from './pixi/AgentSprite';
import { StakingAura } from './pixi/StakingAura';
import { getStakeTierIndex } from '../lib/staking';

interface Props {
  gameRef: React.RefObject<GameState | null>;
  width: number;
  height: number;
}

export default function GameCanvas({ gameRef, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  const init = useCallback(async () => {
    if (!containerRef.current || appRef.current) return;

    const app = new Application();
    await app.init({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
    appRef.current = app;

    const centerX = width / 2;
    const centerY = height / 2;

    // Create scene layers
    const grid = new GridBackground(width, height);
    const stakingAura = new StakingAura(centerX, centerY);
    const dataStream = new DataStream(width, height, centerX, centerY);
    const apiNodes = new ApiNodes(centerX, centerY);
    const agentSprites = new AgentSprites(centerX, centerY);
    const processor = new ProcessorNode(centerX, centerY);

    app.stage.addChild(grid);
    app.stage.addChild(stakingAura);
    app.stage.addChild(dataStream);
    app.stage.addChild(apiNodes);
    app.stage.addChild(agentSprites);
    app.stage.addChild(processor);

    // Ticker — reads game state from ref, no React re-renders
    app.ticker.add((ticker) => {
      const game = gameRef.current;
      if (!game || game.phase !== 'playing') return;

      const dt = ticker.deltaMS / 1000;

      grid.update(game.tier, dt);
      processor.update(game.tier, dt);
      dataStream.update(game.rps, game.accuracy, dt);

      apiNodes.update(
        game.apis.map((a) => ({
          id: a.id,
          status: a.status,
          buildProgress: a.buildProgress,
          x: 0,
          y: 0,
        })),
        dt,
      );

      agentSprites.update(
        game.agents.map((a) => ({
          id: a.id,
          status: a.status,
        })),
        dt,
      );

      const stakeTier = getStakeTierIndex(game.agoraStaked);
      stakingAura.update(stakeTier + 1, dt); // +1 because -1=none, 0=tier1
    });
  }, [width, height, gameRef]);

  useEffect(() => {
    init();
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [init]);

  return (
    <div
      ref={containerRef}
      data-tutorial="canvas"
      style={{ width, height }}
      className="relative"
    />
  );
}
