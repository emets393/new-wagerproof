import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, ShoppingCart, Package, ShieldCheck } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { toast } from 'sonner';

type Product = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  price: string;
  badge?: string;
  includes: string[];
};

const products: Product[] = [
  { id: 'mlb', title: 'MLB Raw Data', description: 'Pitch-by-pitch and game-level aggregates across multiple seasons.', price: '$79', badge: 'Popular', includes: ['Games', 'Player stats', 'Odds history (where available)'] },
  { id: 'nba', title: 'NBA Raw Data', description: 'Play-by-play and team aggregates with betting lines.', price: '$79', includes: ['Games', 'Team stats', 'Odds (open/close)'] },
  { id: 'nfl', title: 'NFL Raw Data', description: 'Play-level features and game context with historic lines.', price: '$99', includes: ['Games', 'Play features', 'Weather (where available)'] },
  { id: 'ncaaf', title: 'NCAAF Raw Data', description: 'FBS games with lines, results and situational context.', price: '$89', includes: ['Games', 'Team splits', 'Odds (open/close)'] },
  { id: 'ncaab', title: 'NCAAB Raw Data', description: 'D1 games with lines, possessions and efficiencies.', price: '$79', includes: ['Games', 'Eff metrics', 'Odds (open/close)'] },
  { id: 'bundle-nba-ncaab', title: 'Hoops Bundle', subtitle: 'NBA + NCAAB', description: 'Save when you buy both basketball datasets together.', price: '$129', badge: 'Save 18%', includes: ['NBA Raw Data', 'NCAAB Raw Data'] },
  { id: 'bundle-nfl-ncaaf', title: 'Gridiron Bundle', subtitle: 'NFL + NCAAF', description: 'Pro and college football together at a discounted price.', price: '$159', badge: 'Save 20%', includes: ['NFL Raw Data', 'NCAAF Raw Data'] },
];

export default function Marketplace() {
  const [email, setEmail] = useState('');

  const mockPurchase = (p: Product) => {
    toast.success(`Checkout started for ${p.title}`, { description: 'This is a preview flow. Payments will be added next.' });
  };

  const mockDownload = (p: Product) => {
    toast.info(`Preparing ${p.title}`, { description: 'In production this will deliver a signed CSV download.' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Data Marketplace</h1>
          <p className="text-muted-foreground mt-2">Purchase and download raw CSV datasets for your own analysis.</p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="relative overflow-hidden border-2 hover:border-primary/40 transition-colors">
              {p.badge && (
                <div className="absolute right-3 top-3">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{p.badge}</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {p.title}
                    {p.subtitle && (
                      <span className="block text-sm font-normal text-muted-foreground">{p.subtitle}</span>
                    )}
                  </span>
                  <span className="text-2xl font-bold">{p.price}</span>
                </CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
                  {p.includes.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => mockPurchase(p)}>
                    <ShoppingCart className="h-4 w-4 mr-2" /> Buy
                  </Button>
                  <Button variant="outline" onClick={() => mockDownload(p)}>
                    <Download className="h-4 w-4 mr-2" /> Sample CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Questions or custom data needs?</CardTitle>
              <CardDescription>Leave your email and we’ll reach out.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Label htmlFor="contact-email" className="sr-only">Email</Label>
                  <Input id="contact-email" type="email" placeholder="you@company.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
                </div>
                <Button onClick={()=> toast.success('Thanks! We will contact you shortly.')}>Submit</Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                <ShieldCheck className="h-4 w-4" /> Secure delivery. You’ll receive signed links to CSV files.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Toaster />
    </div>
  );
}


