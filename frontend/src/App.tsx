import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Landing } from './pages/Landing';
import { Receive } from './pages/Receive';
import { Pay } from './pages/Pay';
import { Transactions } from './pages/Transactions';
import { Withdraw } from './pages/Withdraw';
import { Settings } from './pages/Settings';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/receive" element={<Receive />} />
            <Route path="/pay" element={<Pay />} />
            <Route path="/pay/:alias" element={<Pay />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/withdraw" element={<Withdraw />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
