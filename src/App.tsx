import React from 'react';
import { useSessionStore } from './store/useSessionStore';
import { WalletConnect } from './components/WalletConnect';
import { Onboarding } from './components/Onboarding';
import { ShieldCheck, Lock, Layers } from 'lucide-react';
import { Outlet, Link, useLocation } from 'react-router-dom';

function App() {
  const { isConnected, metaAddress } = useSessionStore();
  const location = useLocation();

  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* Navigation */}
      <nav className="border-b border-white bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:rotate-6 transition-transform">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800">ZeroLink</span>
          </Link>

          <div className="flex items-center gap-8">
            {isConnected && metaAddress && (
              <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-400">
                <Link to="/dashboard" className={`hover:text-indigo-600 transition-colors ${location.pathname === '/dashboard' ? 'text-indigo-600' : ''}`}>Dashboard</Link>
                <Link to="/withdraw" className={`hover:text-indigo-600 transition-colors ${location.pathname === '/withdraw' ? 'text-indigo-600' : ''}`}>Withdraw</Link>
              </div>
            )}
            <WalletConnect />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        {isHome ? (
          <div className="text-center">
            {!isConnected ? (
              <LandingHero />
            ) : !metaAddress ? (
              <div className="flex justify-center items-center py-10">
                <Onboarding />
              </div>
            ) : (
              <div className="py-20">
                <h1 className="text-4xl font-extrabold mb-6">Welcome Back</h1>
                <p className="text-slate-500 mb-10 text-lg">Your stealth identity is active and ready for private payments.</p>
                <Link
                  to="/dashboard"
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  Enter Dashboard
                </Link>
              </div>
            )}
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-bold">ZeroLink</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-slate-600">Privacy</a>
            <a href="#" className="hover:text-slate-600">Terms</a>
            <a href="#" className="hover:text-slate-600">Twitter</a>
            <a href="#" className="hover:text-slate-600">Docs</a>
          </div>
          <div className="text-sm text-slate-400">
            © 2026 ZeroLink Protocol. Built for Starknet.
          </div>
        </div>
      </footer>
    </div>
  );
}

const LandingHero = () => (
  <div className="max-w-3xl mx-auto mt-10 md:mt-20">
    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold mb-8 animate-bounce">
      <Lock className="w-4 h-4" />
      Privacy-First Payments on Starknet
    </div>
    <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-8">
      Send and receive funds <br />
      <span className="text-indigo-600 decoration-indigo-200 underline underline-offset-8">anonymously.</span>
    </h1>
    <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed text-center">
      ZeroLink uses stealth addresses to hide your identity on-chain.
      No one can track your transactions. No history leaks. Just pure privacy.
    </p>
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <button
        onClick={() => (window as any).starknet?.connect()}
        className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
      >
        Start Using ZeroLink
      </button>
      <button className="px-10 py-4 bg-white text-slate-600 border-2 border-slate-100 rounded-2xl font-bold text-lg hover:border-indigo-100 hover:text-indigo-600 transition-all">
        Read Whitepaper
      </button>
    </div>

    {/* Feature Grid */}
    <div className="grid md:grid-cols-3 gap-8 mt-32 text-left">
      {[
        { icon: ShieldCheck, title: "Self-Custodial", desc: "You hold your keys. We never see them. All crypto happens locally." },
        { icon: Lock, title: "Stealth Addresses", desc: "Every payment generates a new one-time address automatically." },
        { icon: Layers, title: "Starknet Powered", desc: "Lightning fast transactions with minimal fees on L2." }
      ].map((f, i) => (
        <div key={i} className="p-8 bg-white rounded-3xl border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            <f.icon className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold mb-3">{f.title}</h3>
          <p className="text-slate-500 leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

export default App;
