import React from 'react';
import { useSessionStore } from './store/useSessionStore';
import { WalletConnect } from './components/WalletConnect';
import { Onboarding } from './components/Onboarding';
import { ShieldCheck, Lock, Layers, ArrowRight, Zap, Globe, Github } from 'lucide-react';
import { Outlet, Link, useLocation } from 'react-router-dom';

function App() {
  const { isConnected, metaAddress } = useSessionStore();
  const location = useLocation();

  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 bg-glow">
      {/* Navigation */}
      <nav className="border-b border-indigo-50/50 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:rotate-12 transition-all duration-300">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-800">ZeroLink</span>
          </Link>

          <div className="flex items-center gap-10">
            {isConnected && metaAddress && (
              <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500">
                <Link to="/dashboard" className={`hover:text-indigo-600 transition-colors relative py-1 ${location.pathname === '/dashboard' ? 'text-indigo-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-indigo-600 after:rounded-full' : ''}`}>Dashboard</Link>
                <Link to="/withdraw" className={`hover:text-indigo-600 transition-colors relative py-1 ${location.pathname === '/withdraw' ? 'text-indigo-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-indigo-600 after:rounded-full' : ''}`}>Withdraw</Link>
              </div>
            )}
            <WalletConnect />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-24">
        {isHome ? (
          <div className="text-center">
            {!isConnected ? (
              <LandingHero />
            ) : !metaAddress ? (
              <div className="flex justify-center items-center py-12">
                <Onboarding />
              </div>
            ) : (
              <div className="py-24 max-w-2xl mx-auto">
                <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-sm border border-indigo-100 animate-float">
                  <ShieldCheck className="w-12 h-12 text-indigo-600" />
                </div>
                <h1 className="text-5xl font-black mb-6 tracking-tight text-slate-900">Welcome Back</h1>
                <p className="text-slate-500 mb-12 text-xl font-medium leading-relaxed">
                  Your stealth identity is active. Start receiving payments with complete chain-privacy.
                </p>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-3 px-12 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-[0.98] group"
                >
                  Enter Dashboard
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <span className="text-xl font-black">ZeroLink</span>
              </div>
              <p className="text-slate-400 max-w-xs leading-relaxed font-medium">
                The leading privacy protocol on Starknet. Send and receive funds without leaving a trace on the ledger.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-widest text-xs">Resources</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-400">
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Developer Portal</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors">Security Audit</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-widest text-xs">Community</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-400">
                <li><a href="#" className="hover:text-indigo-600 transition-colors flex items-center gap-2"><Globe className="w-4 h-4" /> Twitter</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors flex items-center gap-2"><Github className="w-4 h-4" /> GitHub</a></li>
                <li><a href="#" className="hover:text-indigo-600 transition-colors flex items-center gap-2">Discord</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-300">
            <span>© 2026 ZEROLINK PROTOCOL. ALL RIGHTS RESERVED.</span>
            <div className="flex gap-8">
              <a href="#" className="hover:text-slate-500">PRIVACY POLICY</a>
              <a href="#" className="hover:text-slate-500">TERMS OF SERVICE</a>
            </div>
          </div>
        </div>
      </footer >
    </div >
  );
}

const LandingHero = () => (
  <div className="max-w-4xl mx-auto mt-10 md:mt-16">
    <div className="inline-flex items-center gap-2.5 px-5 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-black mb-10 border border-indigo-100 shadow-sm animate-pulse-subtle uppercase tracking-wider">
      <Zap className="w-4 h-4 fill-indigo-700" />
      Next-Gen Privacy on Starknet
    </div>

    <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tight leading-[1] mb-10">
      Untraceable crypto <br />
      <span className="text-gradient">for everyone.</span>
    </h1>

    <p className="text-xl md:text-2xl text-slate-500 mb-14 max-w-2xl mx-auto font-medium leading-relaxed">
      ZeroLink hides your address from the public eye.
      No transaction history leaks. Just pure, mathematical privacy.
    </p>

    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-32">
      <button
        onClick={() => (window as any).starknet?.connect()}
        className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-[0_20px_40px_-10px_rgba(79,70,229,0.3)] hover:-translate-y-1 active:scale-95 flex items-center gap-3"
      >
        Launch App
        <ArrowRight className="w-6 h-6" />
      </button>
      <button className="px-12 py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl font-bold text-xl hover:bg-slate-50 transition-all hover:border-slate-200">
        Read the Tech
      </button>
    </div>

    {/* Feature Grid */}
    <div className="grid md:grid-cols-3 gap-10 text-left">
      {[
        {
          icon: ShieldCheck,
          title: "Non-Custodial",
          desc: "You always control your funds. We provide the privacy layer, not the wallet.",
          color: "bg-indigo-50 text-indigo-600"
        },
        {
          icon: Lock,
          title: "Stealth Logic",
          desc: "Our protocol generates unique one-time addresses for every single payment.",
          color: "bg-violet-50 text-violet-600"
        },
        {
          icon: Layers,
          title: "L2 Performance",
          desc: "Leveraging Starknet's zero-knowledge proofs for near-zero fees and instant settlement.",
          color: "bg-purple-50 text-purple-600"
        }
      ].map((f, i) => (
        <div key={i} className="group p-10 bg-white rounded-[2.5rem] border border-slate-100 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-2">
          <div className={`w-16 h-16 ${f.color} rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform duration-500`}>
            <f.icon className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-black mb-4 text-slate-800 tracking-tight">{f.title}</h3>
          <p className="text-slate-500 leading-relaxed font-medium">{f.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

export default App;
