import React from 'react';
import { Link } from 'react-router-dom';
import { Download, Mail, Phone, MapPin, Globe, ExternalLink } from 'lucide-react';
import { SEO } from '@/components/landing/SEO';
import { StructuredData } from '@/components/landing/StructuredData';
import { Button } from '@/components/ui/button';

export const PressKit = () => {
  const pressKitItems = [
    {
      title: 'WagerProof Logo - Full Color',
      description: 'Primary logo with full color branding',
      filename: 'wagerproof-logo.png',
      path: '/wagerproof-logo.png'
    },
    {
      title: 'WagerProof Logo - Light',
      description: 'Logo optimized for light backgrounds',
      filename: 'wagerproof-logo-main.png',
      path: '/wagerproof-logo-main.png'
    },
    {
      title: 'WagerProof Green - Light Background',
      description: 'Green themed logo for light backgrounds',
      filename: 'wagerproofGreenLight.png',
      path: '/wagerproofGreenLight.png'
    },
    {
      title: 'WagerProof Green - Dark Background',
      description: 'Green themed logo for dark backgrounds',
      filename: 'wagerproofGreenDark.png',
      path: '/wagerproofGreenDark.png'
    },
  ];

  const brandHighlights = [
    {
      icon: '📊',
      title: 'Data-Driven Analytics',
      description: 'Real-time sports betting analytics powered by advanced data science and machine learning algorithms.'
    },
    {
      icon: '🎯',
      title: 'Precision Predictions',
      description: 'Highly accurate predictions for NFL, College Football, NBA, and more across multiple sports.'
    },
    {
      icon: '🛡️',
      title: 'Responsible Gambling',
      description: 'Committed to promoting responsible gambling practices and financial wellness.'
    },
    {
      icon: '🚀',
      title: 'Innovation First',
      description: 'Cutting-edge technology and tools that revolutionize sports betting analytics.'
    },
    {
      icon: '👥',
      title: 'Community Focused',
      description: 'Building a thriving community of sports enthusiasts and data-driven bettors.'
    },
    {
      icon: '📈',
      title: 'Growing Platform',
      description: 'Rapidly expanding user base and continuously improving features and services.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Press Kit | WagerProof"
        description="WagerProof Press Kit - Logos, company information, and media resources for journalists and content creators."
        canonical="https://wagerproof.bet/press-kit"
        ogType="website"
      />
      <StructuredData type="organization" />

      {/* Back to Home */}
      <div className="pt-24 pb-8">
        <div className="container mx-auto px-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 19l-7-7 7-7" 
              />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="container mx-auto px-4 mb-16 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            WagerProof<br />
            <span className="bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-400 bg-clip-text text-transparent">
              Press Kit
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Everything you need to cover WagerProof - logos, company information, and media resources for journalists and content creators.
          </p>
        </div>

        {/* Quick Contact */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <Mail className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Press Inquiries</h3>
            <a 
              href="mailto:emet@wagerproof.bet"
              className="text-primary hover:underline break-all"
            >
              emet@wagerproof.bet
            </a>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <Globe className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Website</h3>
            <a 
              href="https://wagerproof.bet"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center justify-center gap-2"
            >
              wagerproof.bet
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <Phone className="w-8 h-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Follow Us</h3>
            <a 
              href="https://www.tiktok.com/@wagerproof"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @wagerproof on TikTok
            </a>
          </div>
        </div>
      </div>

      {/* Company Overview */}
      <div className="bg-card border-y border-border py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl font-bold mb-8">About WagerProof</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">Mission</h3>
              <p className="text-muted-foreground mb-6">
                To revolutionize sports betting through data-driven analytics and professional-grade prediction tools, empowering bettors to make informed decisions with confidence.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Vision</h3>
              <p className="text-muted-foreground mb-6">
                To become the leading platform for sports betting analytics, trusted by professionals and enthusiasts worldwide for accurate predictions and actionable insights.
              </p>
            </div>
          </div>

          {/* Brand Highlights */}
          <div className="mt-12">
            <h3 className="text-2xl font-semibold mb-8">Brand Highlights</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {brandHighlights.map((item, index) => (
                <div 
                  key={index}
                  className="bg-background border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <h4 className="font-semibold mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Logos & Assets */}
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <h2 className="text-3xl font-bold mb-12">Logos & Brand Assets</h2>
        
        <div className="grid md:grid-cols-2 gap-8">
          {pressKitItems.map((item, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 aspect-square flex items-center justify-center p-8">
                <img 
                  src={item.path} 
                  alt={item.title}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="p-6">
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                <a
                  href={item.path}
                  download={item.filename}
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Brand Colors */}
        <div className="mt-16">
          <h3 className="text-2xl font-semibold mb-8">Brand Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-full aspect-square bg-emerald-400 rounded-lg mb-3 shadow-md border border-emerald-300"></div>
              <p className="font-semibold text-sm">Primary Green</p>
              <p className="text-xs text-muted-foreground">#22c55e</p>
            </div>
            <div className="text-center">
              <div className="w-full aspect-square bg-green-500 rounded-lg mb-3 shadow-md border border-green-400"></div>
              <p className="font-semibold text-sm">Secondary Green</p>
              <p className="text-xs text-muted-foreground">#16a34a</p>
            </div>
            <div className="text-center">
              <div className="w-full aspect-square bg-stone-900 rounded-lg mb-3 shadow-md border border-stone-700"></div>
              <p className="font-semibold text-sm">Dark Gray</p>
              <p className="text-xs text-muted-foreground">#1c1917</p>
            </div>
            <div className="text-center">
              <div className="w-full aspect-square bg-white rounded-lg mb-3 shadow-md border border-gray-300"></div>
              <p className="font-semibold text-sm">White</p>
              <p className="text-xs text-muted-foreground">#ffffff</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Facts */}
      <div className="bg-card border-y border-border py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl font-bold mb-12">Key Facts</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-lg mb-4">Platform Coverage</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>✓ NFL Predictions & Analytics</li>
                <li>✓ College Football Insights</li>
                <li>✓ NBA Coverage</li>
                <li>✓ NCAAB Analysis</li>
                <li>✓ Multi-sport Integration</li>
                <li>✓ Real-time Data Updates</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4">Features</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>✓ Advanced Predictive Analytics</li>
                <li>✓ Historical Performance Data</li>
                <li>✓ Bet Slip Grading Tools</li>
                <li>✓ WagerBot AI Chat Assistant</li>
                <li>✓ Community Insights</li>
                <li>✓ Professional Dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Media Usage Guidelines */}
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <h2 className="text-3xl font-bold mb-8">Media Usage Guidelines</h2>
        
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 mb-8">
          <h3 className="font-semibold mb-4 text-blue-900 dark:text-blue-100">Guidelines for Logo Usage</h3>
          <ul className="space-y-2 text-blue-800 dark:text-blue-200 text-sm">
            <li>• Use the provided logos in their original colors when possible</li>
            <li>• Maintain proper spacing around the logo (minimum 10% of logo width)</li>
            <li>• Never distort, rotate, or alter the logo design</li>
            <li>• Use either the light or dark version depending on background color</li>
            <li>• Always include the™ trademark symbol with the WagerProof name</li>
            <li>• For questions about logo usage, contact emet@wagerproof.bet</li>
          </ul>
        </div>

        {/* Additional Resources */}
        <div>
          <h3 className="text-2xl font-semibold mb-6">Additional Resources</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-3">Blog & Articles</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Read our latest insights on sports betting analytics, data science, and industry trends.
              </p>
              <Link 
                to="/blog"
                className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
              >
                Visit Blog <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-3">Social Media</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Follow WagerProof on social media for updates, tips, and community engagement.
              </p>
              <a 
                href="https://www.tiktok.com/@wagerproof"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
              >
                @wagerproof <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20 border-y border-border py-16">
        <div className="container mx-auto px-4 max-w-6xl text-center">
          <h2 className="text-3xl font-bold mb-4">Get in Touch</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Have questions about WagerProof? Want to cover our story? We'd love to hear from you!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:emet@wagerproof.bet"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Mail className="w-4 h-4" />
              Email Press Team
            </a>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Visit Website
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="container mx-auto px-4 py-8 max-w-6xl text-center text-sm text-muted-foreground">
        <p>
          Last updated: November 7, 2025 | All assets are provided for media and press purposes only.
        </p>
      </div>
    </div>
  );
};

