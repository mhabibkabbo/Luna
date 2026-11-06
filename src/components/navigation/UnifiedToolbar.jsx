import React from 'react';
import LeftSidebarNav from './LeftSidebarNav.jsx';

/**
 * UnifiedToolbar component now delegates to the accessible, structured LeftSidebarNav panel.
 * Maintained for backward compatibility.
 */
export default function UnifiedToolbar(props) {
  return <LeftSidebarNav {...props} />;
}
