import React, { useCallback, useRef, useState } from 'react';

export const useShellState = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('isSidebarCollapsed');
    return saved === 'true';
  });
  const [isMobileTopBarVisible, setIsMobileTopBarVisible] = useState(true);
  const lastMainScrollTop = useRef(0);

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('isSidebarCollapsed', String(next));
      return next;
    });
  }, []);

  const handleMainScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    if (window.innerWidth >= 768) {
      setIsMobileTopBarVisible((prev) => (prev ? prev : true));
      return;
    }

    const nextScrollTop = event.currentTarget.scrollTop;
    const delta = nextScrollTop - lastMainScrollTop.current;

    if (nextScrollTop <= 24) {
      setIsMobileTopBarVisible(true);
    } else if (delta > 10) {
      setIsMobileTopBarVisible(false);
    } else if (delta < -10) {
      setIsMobileTopBarVisible(true);
    }

    lastMainScrollTop.current = nextScrollTop;
  }, []);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    isMobileTopBarVisible,
    handleMainScroll
  };
};
