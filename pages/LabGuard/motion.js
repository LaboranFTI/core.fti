const stripMotionProps = ({ initial, animate, exit, transition, layout, ...props }) => props;

export const motion = {
  div: (props) => <div {...stripMotionProps(props)} />,
  p: (props) => <p {...stripMotionProps(props)} />,
};

export const AnimatePresence = ({ children }) => <>{children}</>;
