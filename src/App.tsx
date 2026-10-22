import { useEffect } from 'react';
import { useSimulation } from './lib/useSimulation';
import { ErrorBoundary } from './lib/ErrorBoundary';
import { useAtlasStore } from './store/useAtlasStore';
import { Scene } from './scene/Scene';
import { TopBar } from './ui/TopBar';
import { KPIRail } from './ui/KPIRail';
import { BottomBar, CameraControls, ViewBar } from './ui/Controls';
import { Inspector } from './ui/Inspector';
import { AssetsPanel, ShipmentTracking } from './ui/Tracking';
import {
  CommandPalette,
  ContextMenu,
  CreateShipment,
  FleetView,
  Help,
  Toast,
  useShortcuts,
} from './ui/Overlays';
import { NetworkTools } from './ui/NetworkTools';
import { LoadingScreen } from './ui/LoadingScreen';
import { Zone } from './ui/Zone';
import { ControlTower } from './ui/ControlTower';
import { PhotoBar } from './ui/PhotoMode';
import { LayerLegend } from './ui/LayerLegend';
export default function App() {
  useSimulation();
  useShortcuts();
  const hudHidden = useAtlasStore((s) => s.collapsed);
  const photoOn = useAtlasStore((s) => s.photo.on);
  const director = useAtlasStore((s) => s.director);
  const caption = useAtlasStore((s) => s.directorCaption);
  const cine = hudHidden || photoOn;
  const view = useAtlasStore((s) => s.view);
  const selected = useAtlasStore((s) => s.selection);
  const panels = useAtlasStore((s) => s.panels);
  useEffect(() => {
    document.documentElement.dataset.cine = String(cine);
  }, [cine]);
  const showInspector = view !== 'world' || Boolean(selected);
  return (
    <main
      className={`app hud-shell view-${view} ${cine ? 'cine' : ''}`}
      data-left={panels.left}
      data-right={panels.right}
      data-dock={panels.dock}
    >
      <div className="shell">
        <div className="zone-top">
          <ErrorBoundary name="Top bar">
            <TopBar />
          </ErrorBoundary>
        </div>
        <Zone name="left" className="zone-left">
          <ErrorBoundary name="Performance cards">
            <KPIRail />
          </ErrorBoundary>
          <ErrorBoundary name="Control tower">
            <ControlTower />
          </ErrorBoundary>
        </Zone>
        <div className="zone-view">
          <ErrorBoundary name="View controls">
            <ViewBar />
          </ErrorBoundary>
          <div className="viewport">
            <ErrorBoundary name="3D scene" scene>
              <Scene />
            </ErrorBoundary>
            {view === 'fleet' && (
              <ErrorBoundary name="Fleet overview">
                <FleetView />
              </ErrorBoundary>
            )}
            <ErrorBoundary name="Camera controls">
              <CameraControls />
            </ErrorBoundary>
            <ErrorBoundary name="Settings">
              <NetworkTools part="settings" />
            </ErrorBoundary>
            <div className="camera-hint">
              <span className="dot green" />
              DRAG ORBIT <i>·</i> SCROLL ZOOM <i>·</i> H CINEMA <i>·</i> K / I / T PANELS
            </div>
            {hudHidden && !photoOn && <div className="cine-hint">Press H to show the HUD</div>}
            {director && caption && (
              <div className="director-caption" role="status" key={caption}>
                <i /> DIRECTOR <span>{caption}</span>
              </div>
            )}
            <PhotoBar />
            <LayerLegend />
          </div>
        </div>
        <Zone name="right" className="zone-right">
          <div className="right-stack">
            {showInspector && (
              <ErrorBoundary name="Inspector">
                <Inspector />
              </ErrorBoundary>
            )}
            <ErrorBoundary name="Minimap">
              <NetworkTools part="minimap" />
            </ErrorBoundary>
          </div>
        </Zone>
        <Zone name="dock" className="zone-dock">
          <div className="dock-grid">
            <ErrorBoundary name="Shipment tracking">
              <ShipmentTracking />
            </ErrorBoundary>
            <ErrorBoundary name="Assets list">
              <AssetsPanel />
            </ErrorBoundary>
          </div>
        </Zone>
        <div className="zone-foot">
          <ErrorBoundary name="Simulation controls">
            <BottomBar />
          </ErrorBoundary>
        </div>
      </div>
      <ErrorBoundary name="Search">
        <CommandPalette />
      </ErrorBoundary>
      <ErrorBoundary name="Shipment form">
        <CreateShipment />
      </ErrorBoundary>
      <ErrorBoundary name="Help">
        <Help />
      </ErrorBoundary>
      <ErrorBoundary name="Context menu">
        <ContextMenu />
      </ErrorBoundary>
      <Toast />
      <LoadingScreen />
    </main>
  );
}
