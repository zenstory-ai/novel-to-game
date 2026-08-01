import React from 'react';
import {Composition} from 'remotion';
import {ProjectPlateauPromo} from './project-plateau-promo.jsx';

export const RemotionRoot = () => (
  <Composition
    id="ProjectPlateauPromo"
    component={ProjectPlateauPromo}
    durationInFrames={1080}
    fps={30}
    width={1920}
    height={1080}
  />
);
