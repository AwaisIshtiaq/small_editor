import {Composition} from 'remotion';
import {WebIll} from './WebIll';
import {DesktopIll} from './DesktopIll';

// Transparent, seamless 3s loops (90 frames @ 30fps) used on the "Works the way you work" cards.
export const Root = () => (
  <>
    <Composition id="WebIll" component={WebIll} durationInFrames={90} fps={30} width={400} height={340} />
    <Composition id="DesktopIll" component={DesktopIll} durationInFrames={90} fps={30} width={400} height={340} />
  </>
);
