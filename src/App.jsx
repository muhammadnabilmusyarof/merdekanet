import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LiveStage from './components/LiveStage';
import AdminInput from './components/AdminInput';
import PublicCheck from './components/PublicCheck';
import WinnersList from './components/WinnersList';
import SqlModal from './components/SqlModal';
import { useTicketsStore } from './lib/useTicketsStore';

function getInitialRoute() {
  if (typeof window === 'undefined') return 'stage';
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();

  if (
    path.endsWith('/inputnomorkupon') ||
    path === '/inputnomorkupon' ||
    hash.includes('inputnomorkupon') ||
    search.includes('inputnomorkupon')
  ) {
    return 'admin';
  }
  if (hash.includes('check')) return 'check';
  if (hash.includes('winners')) return 'winners';
  return 'stage';
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getInitialRoute);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  useEffect(() => {
    const handleLocationChange = () => {
      setActiveTab(getInitialRoute());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'admin') {
      window.history.pushState({}, '', '/inputnomorkupon');
    } else if (tabId === 'stage') {
      window.history.pushState({}, '', '/');
    } else {
      window.history.pushState({}, '', `#${tabId}`);
    }
  };

  const {
    tickets,
    winners,
    prizes,
    selectedPrize,
    setSelectedPrize,
    isUsingSupabase,
    supabaseError,
    latestIncomingTicket,
    addTicket,
    deleteTicket,
    markTicketAsWinner,
    resetAllTickets,
    populateDemoTickets,
    populateRange,
    refetch,
  } = useTicketsStore();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isUsingSupabase={isUsingSupabase}
        supabaseError={supabaseError}
        totalTickets={tickets.length}
        onOpenSqlModal={() => setIsSqlModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'stage' && (
          <LiveStage
            tickets={tickets}
            prizes={prizes}
            selectedPrize={selectedPrize}
            setSelectedPrize={setSelectedPrize}
            onMarkWinner={markTicketAsWinner}
            latestIncomingTicket={latestIncomingTicket}
            isUsingSupabase={isUsingSupabase}
            isAdmin={false}
          />
        )}

        {activeTab === 'admin' && (
          <AdminInput
            tickets={tickets}
            prizes={prizes}
            selectedPrize={selectedPrize}
            setSelectedPrize={setSelectedPrize}
            onMarkWinner={markTicketAsWinner}
            onAddTicket={addTicket}
            onDeleteTicket={deleteTicket}
            onResetAll={resetAllTickets}
            onPopulateDemo={populateDemoTickets}
            onPopulateRange={populateRange}
            isUsingSupabase={isUsingSupabase}
          />
        )}

        {activeTab === 'check' && <PublicCheck tickets={tickets} />}

        {activeTab === 'winners' && (
          <WinnersList
            winners={winners}
            onSwitchToStage={() => setActiveTab('stage')}
          />
        )}
      </main>

      {/* Supabase SQL Setup Modal */}
      <SqlModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
        isUsingSupabase={isUsingSupabase}
        supabaseError={supabaseError}
        onRefresh={refetch}
      />
    </div>
  );
}
