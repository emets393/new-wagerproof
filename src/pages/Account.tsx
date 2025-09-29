import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, User } from 'lucide-react';

export default function Account() {
  const { user, loading, signIn, signUp, signOut, signInWithProvider, sendPasswordReset, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetMode, setResetMode] = useState<boolean>(() => new URLSearchParams(window.location.search).get('reset') === '1');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('login');

  // Stay on account page even if authenticated (show profile view)

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
        ? await signIn(email, password)
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handleProvider = async (provider: 'google' | 'apple') => {
    setError('');
    setIsLoading(true);
    const { error } = await signInWithProvider(provider);
    if (error) setError(error.message);
    setIsLoading(false);
  };

  const handleSendReset = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    const { error } = await sendPasswordReset(email);
    if (error) setError(error.message); else setSuccess('Password reset email sent.');
    setIsLoading(false);
  };

  const handleUpdatePassword = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);
    const { error } = await updatePassword(newPassword);
    if (error) setError(error.message); else setSuccess('Password updated. You can now sign in.');
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show user profile if authenticated
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Welcome Back!</CardTitle>
              <CardDescription>You're signed in as {user.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleSignOut} className="w-full" variant="outline">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Wagerproof
            </CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                {resetMode ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input id="new-password" type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} placeholder="Enter new password" />
                    </div>
                    <Button className="w-full" onClick={handleUpdatePassword} disabled={isLoading || !newPassword}>Update Password</Button>
                    <Button variant="ghost" className="w-full" onClick={()=>setResetMode(false)}>Back to Sign In</Button>
                  </div>
                ) : (
                <form onSubmit={(e) => handleSubmit(e, 'login')} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={isLoading}
                    />
                  </div>
                  
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={()=>handleProvider('google')} disabled={isLoading}>Sign in with Google</Button>
                    <Button type="button" variant="outline" onClick={()=>handleProvider('apple')} disabled={isLoading}>Sign in with Apple</Button>
                  </div>
                  <Button type="button" variant="ghost" className="w-full" onClick={handleSendReset} disabled={!email || isLoading}>Forgot password?</Button>
                </form>
                )}
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      disabled={isLoading}
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
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={()=>handleProvider('google')} disabled={isLoading}>Sign up with Google</Button>
                    <Button type="button" variant="outline" onClick={()=>handleProvider('apple')} disabled={isLoading}>Sign up with Apple</Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}