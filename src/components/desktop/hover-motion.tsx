'use client'

// Remotion-powered hover animation for the pencil-sketch icons.
// At rest the plain SVG is rendered, so the page looks pixel-identical to the
// design. On first hover a <Player> mounts and loops a short composition that
// gently lifts and wiggles the sketch (frame 0 equals the static pose, so the
// switch is seamless). Leaving the icon pauses and rewinds to frame 0.

import { useEffect, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

const DURATION = 48 // frames @30fps = 1.6s loop
const FPS = 30

export type SketchMoveProps = { children: React.ReactNode }

const SketchMove: React.FC<SketchMoveProps> = ({ children }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  // pop springs in at the start of each loop, wobble runs continuously
  const pop = spring({ frame: f, fps, config: { damping: 11, stiffness: 150 } })
  const wobble = Math.sin((f / DURATION) * Math.PI * 4) * 1.8
  const y = interpolate(pop, [0, 1], [0, -6])
  const scale = interpolate(pop, [0, 1], [1, 1.045])
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          transform: `translateY(${y}px) rotate(${wobble}deg) scale(${scale})`,
          transformOrigin: '50% 85%',
          width: '100%',
          height: '100%',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

export type SketchHoverProps = {
  art: React.ReactNode
  label: string
  w?: number
  h?: number
}

export function SketchHover({ art, label, w = 200, h = 150 }: SketchHoverProps) {
  const ref = useRef<PlayerRef>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (live) ref.current?.play()
  }, [live])

  return (
    <div
      className="skh"
      role="img"
      aria-label={label}
      tabIndex={0}
      onMouseEnter={() => setLive(true)}
      onMouseLeave={() => {
        ref.current?.pause()
        ref.current?.seekTo(0)
      }}
      onFocus={() => setLive(true)}
      onBlur={() => {
        ref.current?.pause()
        ref.current?.seekTo(0)
      }}
      onTouchStart={() => setLive(true)}
    >
      {live ? (
        <Player
          ref={ref}
          component={SketchMove}
          inputProps={{ children: art }}
          durationInFrames={DURATION}
          fps={FPS}
          compositionWidth={w}
          compositionHeight={h}
          loop
          autoPlay={false}
          controls={false}
          clickToPlay={false}
          showVolumeControls={false}
          allowFullscreen={false}
          acknowledgeRemotionLicense
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        art
      )}
    </div>
  )
}
