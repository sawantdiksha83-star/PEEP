/**
 * App — root component for the PEEP dApp.
 *
 * Tab layout: "Participant" | "Organizer" (Requirements 1.1, 5.1, 5.3, 5.4)
 * Mobile-first responsive layout. Requirements: 6.1, 6.2, 6.3
 */

import React, { useState } from 'react';
import { useMidnight } from './hooks/useMidnight';
import { WalletConnect } from './components/WalletConnect';
import { EligibilityVerification } from './components/EligibilityVerification';
import { EventPass } from './components/EventPass';
import { QRCodePass } from './components/QRCodePass';
import { OrganizerPanel } from './components/OrganizerPanel';
import type { PassRecord } from '../../src/peep-types';

type Tab = 'participant' | 'organizer';

const TAB_LABELS: Record<Tab, string> = {
  participant: 'Participant',
  organizer: 'Organizer',
};

function App(): React.ReactElement {
  const midnight = useMidnight();
  const [activeTab, setActiveTab] = useState<Tab>('participant');
  const [issuedPass, setIssuedPass] = useState<PassRecord | null>(null);

  const handlePassIssued = (pass: PassRecord) => {
    setIssuedPass(pass);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Skip to content — keyboard navigation accessibility ─────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-indigo-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-md focus:font-medium focus:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Skip to main content
      </a>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-indigo-700 text-white px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            PEEP — Private Event Eligibility Pass
          </h1>
          {/* Privacy banner — Requirements 5.1, 5.3 — text-indigo-100 for WCAG AA contrast */}
          <p className="text-xs sm:text-sm text-indigo-100 mt-1">
            Your eligibility is verified without revealing your personal information.
          </p>
        </div>
      </header>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <nav
            className="flex"
            role="tablist"
            aria-label="Application tabs"
          >
            {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`panel-${tab}`}
                id={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main id="main-content" className="flex-1 px-4 sm:px-6 py-6" tabIndex={-1}>
        <div className="max-w-2xl mx-auto flex flex-col gap-5">

          {/* ── Participant tab ───────────────────────────────────────── */}
          <section
            id="panel-participant"
            role="tabpanel"
            aria-labelledby="tab-participant"
            hidden={activeTab !== 'participant'}
            className="flex flex-col gap-5"
          >
            <Card step="1" title="Connect Wallet">
              <WalletConnect wallet={midnight} />
            </Card>

            <Card step="2" title="Verify Eligibility">
              <EligibilityVerification
                issuePass={midnight.issuePass}
                onPassIssued={handlePassIssued}
                connected={midnight.connected}
              />
            </Card>

            {issuedPass && (
              <>
                <Card step="3" title="Your Event Pass">
                  <EventPass pass={issuedPass} />
                </Card>

                <Card step="4" title="Entry QR Code">
                  <QRCodePass pass={issuedPass} />
                </Card>
              </>
            )}
          </section>

          {/* ── Organizer tab ──────────────────────────────────────────── */}
          <section
            id="panel-organizer"
            role="tabpanel"
            aria-labelledby="tab-organizer"
            hidden={activeTab !== 'organizer'}
            className="flex flex-col gap-5"
          >
            <Card step="1" title="Connect Wallet">
              <WalletConnect wallet={midnight} />
            </Card>

            <Card step="2" title="Verify &amp; Mark Entry">
              <OrganizerPanel
                getPassState={midnight.getPassState}
                markUsed={midnight.markUsed}
                connected={midnight.connected}
              />
            </Card>
          </section>

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="text-center text-xs text-gray-600 py-4 px-4 border-t border-gray-200">
        Built on Midnight Network · Zero-knowledge eligibility · No identity disclosed
      </footer>
    </div>
  );
}

// ─── Card layout helper ───────────────────────────────────────────────────────

interface CardProps {
  step: string;
  title: string;
  children: React.ReactNode;
}

function Card({ step, title, children }: CardProps): React.ReactElement {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <span
          className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center"
          aria-hidden="true"
        >
          {step}
        </span>
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default App;
