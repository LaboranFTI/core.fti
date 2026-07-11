import React from 'react';

const stripMotionProps = ({ initial, animate, exit, transition, layout, ...props }) => props;

export const motion = {
  div: (props) => React.createElement('div', stripMotionProps(props)),
  p: (props) => React.createElement('p', stripMotionProps(props)),
};

export const AnimatePresence = ({ children }) => children;
