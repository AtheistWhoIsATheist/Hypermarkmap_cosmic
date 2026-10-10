import React from 'react';
import { TopologyVisualizer } from './components/TopologyVisualizer';

export default function App() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black select-none">
      <TopologyVisualizer />
    </main>
  );
}
