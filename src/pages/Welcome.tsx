import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavigate } from 'react-router-dom';
import { Loader2, BarChart3, Target, TrendingUp, Brain, Upload } from 'lucide-react';

export default function Welcome() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('login');

  // Redirect authenticated users to home
  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent, action: 'login' | 'signup') => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = action === 'login' 
        ? await signIn(email, password, rememberMe)
        : await signUp(email, password);

      if (error) {
        setError(error.message);
      } else if (action === 'signup') {
        setSuccess('Check your email for the confirmation link!');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Brain,
      title: "Pattern Recognition",
      description: "Identify profitable betting trends with advanced AI algorithms"
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Live game data and comprehensive performance metrics"
    },
    {
      icon: TrendingUp,
      title: "ROI Tracking",
      description: "Monitor and optimize your betting performance over time"
    },
    {
      icon: Target,
      title: "Custom Models",
      description: "Build personalized prediction algorithms tailored to your strategy"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-4rem)]">
          
          {/* Left Side - Branding & Features */}
          <div className="space-y-8">
            {/* Logo and Hero */}
            <div className="text-center lg:text-left space-y-6">
              <div className="flex justify-center lg:justify-start">
                <div className="p-6 bg-white rounded-xl shadow-lg">
                  <Upload className="h-16 w-16 text-primary mx-auto" />
                  <p className="text-sm text-muted mt-2">Upload your WAGER PROOF logo</p>
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-bold text-accent drop-shadow-lg">
                  Advanced Baseball Analytics
                </h1>
                <p className="text-xl text-white/90">
                  Data-driven insights for serious bettors. Make informed decisions with professional-grade analytics.
                </p>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="p-6 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 rounded-lg bg-accent/20">
                      <feature.icon className="h-6 w-6 text-accent" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm text-white/80">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Authentication Forms */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
              <CardHeader className="text-center space-y-4">
                <CardTitle className="text-2xl font-bold text-primary">
                  Get Started
                </CardTitle>
                <CardDescription className="text-muted">
                  Sign in to your account or create a new one to access advanced analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 bg-muted/20">
                    <TabsTrigger value="login" className="text-primary data-[state=active]:bg-accent data-[state=active]:text-primary">Sign In</TabsTrigger>
                    <TabsTrigger value="signup" className="text-primary data-[state=active]:bg-accent data-[state=active]:text-primary">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login" className="space-y-4 mt-6">
                    <form onSubmit={(e) => handleSubmit(e, 'login')} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-primary font-medium">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          disabled={isLoading}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-primary font-medium">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          disabled={isLoading}
                          className="h-11"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                          disabled={isLoading}
                        />
                        <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-primary">
                          Remember me for 30 days
                        </Label>
                      </div>
                      
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      
                      <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Signing In...
                          </>
                        ) : (
                          'Sign In'
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="signup" className="space-y-4 mt-6">
                    <form onSubmit={(e) => handleSubmit(e, 'signup')} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          disabled={isLoading}
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create a strong password"
                          disabled={isLoading}
                          className="h-11"
                        />
                      </div>
                      
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      
                      {success && (
                        <Alert>
                          <AlertDescription>{success}</AlertDescription>
                        </Alert>
                      )}
                      
                      <Button type="submit" className="w-full h-11" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating Account...
                          </>
                        ) : (
                          'Create Account'
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}