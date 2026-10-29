import React from 'react';
import { TopologyVisualizer } from './components/TopologyVisualizer';

export default function App() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-black select-none">
      <TopologyVisualizer />
    </div>
  );
}
