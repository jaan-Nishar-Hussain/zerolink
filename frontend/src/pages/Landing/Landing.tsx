import { Link } from 'react-router-dom';
import {
    Shield,
    Lock,
    Zap,
    Eye,
    ArrowRight,
    CheckCircle2,
    Sparkles,
    Globe
} from 'lucide-react';
import './Landing.css';

export function Landing() {
    const features = [
        {
            icon: Lock,
            title: 'Complete Privacy',
            description: 'Every payment creates a unique stealth address. No one can link your payments together.',
        },
        {
            icon: Eye,
            title: 'Zero Knowledge',
            description: 'Your private keys never leave your device. We can\'t see your funds or transactions.',
        },
        {
            icon: Zap,
            title: 'Instant Payments',
            description: 'Powered by Starknet for fast, cheap transactions with maximum security.',
        },
        {
            icon: Globe,
            title: 'Universal Links',
            description: 'Share one payment link. Receive unlimited private payments to unique addresses.',
        },
    ];

    const steps = [
        { number: '01', title: 'Create Your Link', description: 'Generate your private payment link in seconds' },
        { number: '02', title: 'Share It Anywhere', description: 'Post on social media, send via email, add to your bio' },
        { number: '03', title: 'Receive Privately', description: 'Each payment goes to a unique stealth address' },
        { number: '04', title: 'Withdraw Freely', description: 'Spend from any address without revealing your identity' },
    ];

    return (
        <div className="landing">
            {/* Hero Section */}
            <section className="hero glow-bg">
                <div className="hero-content animate-slide-up">
                    <div className="hero-badge">
                        <Sparkles size={14} />
                        <span>Privacy-First Payments</span>
                    </div>

                    <h1 className="hero-title">
                        Private Payments,<br />
                        <span className="text-gradient">Infinite Addresses</span>
                    </h1>

                    <p className="hero-subtitle">
                        Accept crypto payments without exposing your wallet.
                        ZeroLink creates a unique stealth address for every transaction.
                    </p>

                    <div className="hero-actions">
                        <Link to="/receive" className="btn btn-primary btn-lg">
                            Create Payment Link
                            <ArrowRight size={18} />
                        </Link>
                        <Link to="/pay" className="btn btn-secondary btn-lg">
                            Make a Payment
                        </Link>
                    </div>

                    <div className="hero-trust">
                        <CheckCircle2 size={16} className="text-accent" />
                        <span>100% client-side cryptography • No custody • Open source</span>
                    </div>
                </div>

                <div className="hero-visual">
                    <div className="hero-card glass">
                        <div className="hero-card-header">
                            <Shield className="text-accent" size={24} />
                            <span>zerolink.pay/@satoshi</span>
                        </div>
                        <div className="hero-card-body">
                            <div className="stealth-demo">
                                <div className="stealth-address">0x7a3f...8c2d</div>
                                <div className="stealth-address">0x9e1b...4f7a</div>
                                <div className="stealth-address">0x2c4d...1e9f</div>
                                <div className="stealth-pulse">Every payment is unique</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features">
                <div className="container">
                    <div className="section-header">
                        <h2>Why ZeroLink?</h2>
                        <p className="text-secondary">
                            Traditional wallets expose your entire transaction history.
                            ZeroLink keeps you private.
                        </p>
                    </div>

                    <div className="features-grid">
                        {features.map((feature, index) => (
                            <div key={index} className="feature-card card">
                                <div className="feature-icon">
                                    <feature.icon size={24} />
                                </div>
                                <h3>{feature.title}</h3>
                                <p className="text-secondary">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="how-it-works">
                <div className="container">
                    <div className="section-header">
                        <h2>How It Works</h2>
                        <p className="text-secondary">
                            Simple for users, powerful cryptography under the hood
                        </p>
                    </div>

                    <div className="steps">
                        {steps.map((step, index) => (
                            <div key={index} className="step">
                                <div className="step-number text-gradient">{step.number}</div>
                                <div className="step-content">
                                    <h3>{step.title}</h3>
                                    <p className="text-secondary">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta glow-bg">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Go Private?</h2>
                        <p className="text-secondary">
                            Create your stealth payment link in under 30 seconds. No signup required.
                        </p>
                        <Link to="/receive" className="btn btn-primary btn-lg">
                            Get Started Free
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <Shield className="text-accent" size={20} />
                            <span className="text-gradient">ZeroLink</span>
                        </div>
                        <p className="text-muted">
                            Privacy-first payments powered by Starknet
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
