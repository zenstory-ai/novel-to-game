import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const palette = {
  ink: '#111915',
  canopy: '#193C2B',
  fern: '#3F6A43',
  basalt: '#8B3F2F',
  vermilion: '#C24B34',
  brass: '#B08B4F',
  ivory: '#F1E8D0',
  canvas: '#E8DFC7',
  amber: '#F2D08B',
  silver: '#C7CEC7',
};

const font = 'Arial, Helvetica, sans-serif';
const serif = 'Georgia, Times New Roman, serif';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
};

const fadeWindow = (frame, start, end, fade = 12) =>
  Math.min(
    interpolate(frame, [start, start + fade], [0, 1], clamp),
    interpolate(frame, [end - fade, end], [1, 0], clamp),
  );

const Grain = ({opacity = 0.12}) => (
  <AbsoluteFill
    style={{
      opacity,
      mixBlendMode: 'soft-light',
      backgroundImage:
        'repeating-radial-gradient(circle at 23% 31%, rgba(255,255,255,.28) 0 0.7px, transparent 0.9px 3px)',
      backgroundSize: '5px 5px',
      pointerEvents: 'none',
    }}
  />
);

const Rule = ({width, color = palette.brass}) => (
  <div style={{height: 3, width, background: color, borderRadius: 999}} />
);

const Opener = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = spring({frame, fps, config: {damping: 18, stiffness: 85}});
  const exit = interpolate(frame, [74, 104], [1, 0], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  const arrow = interpolate(frame, [16, 54], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        color: palette.ivory,
        background:
          `radial-gradient(circle at 74% 48%, ${palette.basalt} 0, transparent 30%), ` +
          `linear-gradient(118deg, ${palette.ink} 0%, ${palette.canopy} 60%, #253e31 100%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-18%',
          opacity: 0.16,
          transform: `translateX(${interpolate(frame, [0, 104], [-50, 80])}px) rotate(-8deg)`,
          background:
            `linear-gradient(90deg, transparent 45%, ${palette.amber} 45% 46%, transparent 46% 56%, ${palette.basalt} 56% 72%, transparent 72%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 128,
          top: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          fontFamily: font,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 5,
          color: palette.amber,
          opacity: exit,
        }}
      >
        NOVELTOGAME <Rule width={140} /> SOURCE-TO-PLAYABLE PROOF
      </div>

      <div
        style={{
          position: 'absolute',
          right: 118,
          top: 292,
          width: 450,
          padding: '30px 34px 32px',
          borderTop: `3px solid ${palette.brass}`,
          background: 'rgba(17,25,21,.56)',
          boxShadow: '0 24px 80px rgba(0,0,0,.22)',
          opacity: exit * interpolate(frame, [12, 34], [0, 1], clamp),
          transform: `translateX(${interpolate(frame, [12, 42], [50, 0], clamp)}px) rotate(-1deg)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 17,
            fontWeight: 900,
            letterSpacing: 4,
            color: palette.amber,
            marginBottom: 18,
          }}
        >
          SOURCE · CHAPTER IX
        </div>
        <div style={{fontFamily: serif, fontSize: 31, lineHeight: 1.28, color: palette.canvas}}>
          “And there we were … upon the dreamland, the lost world.”
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: font,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2,
            color: palette.silver,
          }}
        >
          ARTHUR CONAN DOYLE · 1912
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 128,
          top: 280,
          width: 1420,
          opacity: exit,
          transform: `translateY(${(1 - rise) * 54}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: 7,
            color: palette.silver,
            marginBottom: 34,
          }}
        >
          THE LOST WORLD · 1912
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 120,
            lineHeight: 0.96,
            letterSpacing: -5,
            maxWidth: 1480,
          }}
        >
          A novel became
          <br />
          <span style={{color: palette.amber}}>a playable world.</span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 118,
          bottom: 94,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          opacity: exit,
          transform: `translateX(${(1 - arrow) * -80}px)`,
          fontFamily: font,
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: 3,
        }}
      >
        SOURCE
        <div style={{width: 150 * arrow, height: 2, background: palette.brass}} />
        <span style={{fontSize: 44, color: palette.amber}}>→</span>
        PLAYABLE 3D
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

const storyBeats = [
  {start: 0, end: 135, kicker: '01 · EXPLORE', title: 'Cross a connected plateau.'},
  {start: 135, end: 300, kicker: '02 · COMMIT', title: 'Expose four physical glass plates.'},
  {start: 300, end: 510, kicker: '03 · OBSERVE', title: 'Read a living dinosaur family.'},
  {start: 510, end: 780, kicker: '04 · RETURN', title: 'Survive the open sky.'},
  {start: 780, end: 900, kicker: '05 · PROVE', title: 'Bring home what survived.'},
];

const BeatCaption = ({beat, frame}) => {
  const opacity = fadeWindow(frame, beat.start, beat.end, 16);
  const slide = interpolate(frame, [beat.start, beat.start + 22], [34, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 104,
        bottom: 108,
        opacity,
        transform: `translateY(${slide}px)`,
        color: palette.ivory,
        textShadow: '0 3px 24px rgba(0,0,0,.92)',
        padding: '17px 25px 19px',
        borderLeft: `4px solid ${palette.amber}`,
        background: 'linear-gradient(90deg, rgba(17,25,21,.86), rgba(17,25,21,.35) 72%, transparent)',
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: 4.5,
          color: palette.amber,
          marginBottom: 13,
        }}
      >
        {beat.kicker}
      </div>
      <div style={{fontFamily: serif, fontSize: 59, fontWeight: 700, letterSpacing: -1.8}}>
        {beat.title}
      </div>
    </div>
  );
};

const Gameplay = () => {
  const frame = useCurrentFrame();
  const enter = spring({frame, fps: 30, config: {damping: 20, stiffness: 90}});
  const progress = interpolate(frame, [0, 900], [0, 1], clamp);
  const sceneOpacity = Math.min(
    interpolate(frame, [0, 28], [0, 1], clamp),
    interpolate(frame, [872, 900], [1, 0], clamp),
  );

  return (
    <AbsoluteFill style={{background: palette.ink, overflow: 'hidden', opacity: sceneOpacity}}>
      <OffthreadVideo
        src={staticFile('gameplay.mp4')}
        muted
        style={{
          position: 'absolute',
          inset: -40,
          width: 2000,
          height: 1160,
          objectFit: 'cover',
          filter: 'blur(28px) saturate(.72) brightness(.46)',
          transform: 'scale(1.08)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(9,18,14,.74) 0%, rgba(9,18,14,.04) 24%, rgba(9,18,14,.08) 58%, rgba(9,18,14,.92) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '-20% -35%',
          opacity: 0.12,
          transform: `translateX(${interpolate(frame, [0, 900], [-520, 1120], clamp)}px) rotate(-12deg)`,
          background: 'linear-gradient(90deg, transparent 38%, rgba(242,208,139,.8) 50%, transparent 62%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <OffthreadVideo
        src={staticFile('gameplay.mp4')}
        muted
        style={{
          position: 'absolute',
          left: 96,
          top: 0,
          width: 1728,
          height: 1080,
          objectFit: 'contain',
          boxShadow: '0 0 0 1px rgba(241,232,208,.22), 0 24px 80px rgba(0,0,0,.5)',
          transform: `scale(${0.982 + enter * 0.018})`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 98,
          top: 72,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontFamily: font,
          color: palette.ivory,
          textShadow: '0 2px 18px rgba(0,0,0,.9)',
        }}
      >
        <span style={{fontWeight: 900, fontSize: 29, letterSpacing: 4}}>PROJECT PLATEAU</span>
        <Rule width={82} />
        <span style={{fontWeight: 700, fontSize: 20, letterSpacing: 3, color: palette.silver}}>
          THE LOST WORLD → FIRST-PERSON 3D
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 98,
          top: 68,
          padding: '12px 18px',
          border: `1px solid ${palette.brass}`,
          background: 'rgba(17,25,21,.72)',
          fontFamily: font,
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: 2.6,
          color: palette.amber,
        }}
      >
        REAL GAMEPLAY · CONTINUOUS INPUT-ONLY RUN
      </div>

      {storyBeats.map((beat) => (
        <BeatCaption key={beat.kicker} beat={beat} frame={frame} />
      ))}

      <div
        style={{
          position: 'absolute',
          left: 104,
          right: 104,
          bottom: 62,
          height: 3,
          background: 'rgba(241,232,208,.26)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: palette.amber,
            boxShadow: `0 0 18px ${palette.amber}`,
          }}
        />
      </div>
      <Grain opacity={0.08} />
    </AbsoluteFill>
  );
};

const Closing = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = spring({frame, fps, config: {damping: 18, stiffness: 90}});
  const imageScale = interpolate(frame, [0, 132], [1.06, 1.01], clamp);
  const sceneOpacity = interpolate(frame, [0, 28], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{overflow: 'hidden', background: palette.ink, color: palette.ivory, opacity: sceneOpacity}}
    >
      <Img
        src={staticFile('result.jpg')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${imageScale})`,
          filter: 'saturate(.72) brightness(.38)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            `linear-gradient(90deg, rgba(17,25,21,.98) 0%, rgba(17,25,21,.9) 46%, rgba(17,25,21,.3) 100%), ` +
            'linear-gradient(0deg, rgba(17,25,21,.78), transparent 55%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 124,
          width: 1420,
          opacity: rise,
          transform: `translateY(${(1 - rise) * 48}px)`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: 5,
            color: palette.amber,
            marginBottom: 34,
          }}
        >
          ONE OPEN, REPRODUCIBLE WORKFLOW
        </div>
        <div style={{fontFamily: serif, fontSize: 105, lineHeight: 0.98, letterSpacing: -4}}>
          Adapt the book.
          <br />
          <span style={{color: palette.amber}}>Build the game.</span>
        </div>
        <div
          style={{
            marginTop: 52,
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            alignItems: 'center',
            columnGap: 22,
            rowGap: 14,
            fontFamily: font,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 1,
          }}
        >
          <span style={{padding: '14px 20px', background: palette.ivory, color: palette.ink}}>
            ▶ PLAY
          </span>
          <span style={{color: palette.ivory, fontSize: 29}}>plateau.vibecoco.ai</span>
          <span
            style={{padding: '14px 20px', border: `1px solid ${palette.brass}`, color: palette.amber}}
          >
            ★ SOURCE
          </span>
          <span style={{color: palette.silver}}>github.com/worldwonderer/novel-to-game</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 132,
          bottom: 88,
          fontFamily: font,
          fontSize: 20,
          letterSpacing: 3.5,
          color: palette.silver,
        }}
      >
        EXPLORE THE OPEN WORKFLOW · STAR THE REPOSITORY
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

export const ProjectPlateauPromo = () => (
  <AbsoluteFill style={{background: palette.ink}}>
    <Audio
      src={staticFile('soundtrack.wav')}
      volume={(frame) => {
        const narrationDuck = interpolate(frame, [900, 950], [0.2, 0.32], clamp);
        return Math.min(
          interpolate(frame, [0, 20], [0, 0.32], clamp),
          narrationDuck,
          interpolate(frame, [1020, 1080], [0.32, 0], clamp),
        );
      }}
    />
    <Sequence from={8} premountFor={8}>
      <Audio src={staticFile('voiceover.wav')} volume={1} />
    </Sequence>
    <Sequence durationInFrames={104} premountFor={30}>
      <Opener />
    </Sequence>
    <Sequence from={76} durationInFrames={900} premountFor={30}>
      <Gameplay />
    </Sequence>
    <Sequence from={948} durationInFrames={132} premountFor={30}>
      <Closing />
    </Sequence>
  </AbsoluteFill>
);
