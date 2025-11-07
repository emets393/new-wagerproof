import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useRevenueCatWeb } from '@/hooks/useRevenueCatWeb';
import {
  User,
  Mail,
  Lock,
  CreditCard,
  Bell,
  Moon,
  Sun,
  Shield,
  Loader2,
  CheckCircle2,
  Crown,
  LogIn, // Import LogIn icon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user, updatePassword, sendPasswordReset } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { adminModeEnabled, toggleAdminMode, canEnableAdminMode } = useAdminMode();
  const { hasProAccess, customerInfo, subscriptionType } = useRevenueCatWeb();
  const navigate = useNavigate(); // Initialize navigate
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile state
  const [displayName, setDisplayName] = useState('');
  
  // Account state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const handleUpdateProfile = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // TODO: Implement profile update logic with Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError('Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setError('');
    setSuccess('');
    setIsLoading(true);
    
    try {
      const { error } = await sendPasswordReset(user.email);
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Password reset email sent!');
      }
    } catch (err) {
      setError('Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = () => {
    // RevenueCat Web Billing automatically sends email with customer portal link
    setSuccess(
      'Subscription management links are sent to your email with every confirmation and renewal. Check your email for the link to manage your subscription.'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300/20 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-600/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
          <DialogDescription>
            Manage your account settings and preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <Shield className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mt-4 border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and profile information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={handleUpdateProfile} 
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preferences</CardTitle>
                <CardDescription>
                  Customize your experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Moon className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Sun className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <Label htmlFor="theme" className="text-sm font-medium">
                        Dark Mode
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Toggle dark mode theme
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="theme"
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                </div>

                {canEnableAdminMode && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label htmlFor="admin-mode" className="text-sm font-medium">
                            Admin Mode
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Enable admin-only features
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="admin-mode"
                        checked={adminModeEnabled}
                        onCheckedChange={toggleAdminMode}
                      />
                    </div>
                  </>
                )}

                {/* New Admin-only Onboarding Button */}
                {adminModeEnabled && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <LogIn className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label htmlFor="onboarding-test" className="text-sm font-medium">
                            Test Onboarding
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            (Admin) Restart the onboarding flow for testing.
                          </p>
                        </div>
                      </div>
                      <Button
                        id="onboarding-test"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onOpenChange(false); // Close the modal
                          navigate('/onboarding');
                        }}
                      >
                        Enter Flow
                      </Button>
                    </div>

                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label htmlFor="paywall-test" className="text-sm font-medium">
                            Test Paywall
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            (Admin) Preview the paywall in a new window.
                          </p>
                        </div>
                      </div>
                      <Button
                        id="paywall-test"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open('/onboarding?step=16', '_blank');
                        }}
                      >
                        View Paywall
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    onClick={handleChangePassword}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Change Password
                  </Button>
                  <Button
                    onClick={handlePasswordReset}
                    variant="outline"
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Send Reset Email
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notifications</CardTitle>
                <CardDescription>
                  Manage how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="emailNotifications" className="text-sm font-medium">
                        Email Notifications
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Receive updates via email
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="pushNotifications" className="text-sm font-medium">
                        Push Notifications
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Receive push notifications
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="pushNotifications"
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible account actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="w-full sm:w-auto">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4 mt-4">
            {hasProAccess ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Current Plan</CardTitle>
                    <CardDescription>
                      Manage your subscription and billing details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-4 p-4 border rounded-lg bg-gradient-to-br from-yellow-500/5 to-amber-500/5">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20">
                        <Crown className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">WagerProof Pro</h3>
                        <p className="text-sm text-muted-foreground">
                          Full access to all features
                        </p>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-2xl font-bold">
                            {subscriptionType === 'monthly' && '$40'}
                            {subscriptionType === 'yearly' && '$199'}
                            {!subscriptionType && '—'}
                          </span>
                          <span className="text-muted-foreground">
                            {subscriptionType === 'monthly' && '/month'}
                            {subscriptionType === 'yearly' && '/year'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Active
                        </span>
                      </div>
                      {customerInfo?.entitlements?.active?.['WagerProof Pro']?.expirationDate && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {customerInfo.entitlements.active['WagerProof Pro'].willRenew 
                                ? 'Next billing date' 
                                : 'Expires on'}
                            </span>
                            <span className="font-medium">
                              {new Date(customerInfo.entitlements.active['WagerProof Pro'].expirationDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </>
                      )}
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subscription Type</span>
                        <span className="font-medium capitalize">
                          {subscriptionType || 'Active'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 space-y-4">
                      <Button 
                        onClick={handleManageBilling}
                        className="w-full"
                        variant="outline"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </Button>
                      
                      <div className="space-y-3">
                        <div className="space-y-2 text-xs text-muted-foreground text-center">
                          <p className="font-medium text-foreground">
                            Look for this email in your inbox:
                          </p>
                        </div>
                        
                        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                          <img 
                            src="/revcatemailsubs.png" 
                            alt="Subscription confirmation email example"
                            className="w-full"
                            onError={(e) => {
                              // Fallback if image doesn't load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="p-4 text-center">
                                    <div class="space-y-2 text-sm text-muted-foreground">
                                      <p class="font-semibold text-foreground">📧 Your subscription confirmation email</p>
                                      <p>Subject: "Your subscription started"</p>
                                      <p>From: WagerProof</p>
                                      <p>Contains a blue "Click here" link to manage your subscription</p>
                                    </div>
                                  </div>
                                `;
                              }
                            }}
                          />
                        </div>
                        
                        <div className="space-y-2 text-xs text-muted-foreground text-center">
                          <p>
                            Click the link in your confirmation email to update or cancel your subscription.
                          </p>
                          <p>
                            Have questions? Email us at{' '}
                            <a 
                              href="mailto:admin@wagerproof.bet" 
                              className="text-primary hover:underline font-medium"
                            >
                              admin@wagerproof.bet
                            </a>
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">No Active Subscription</CardTitle>
                  <CardDescription>
                    Upgrade to WagerProof Pro for full access
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8">
                    <Crown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      You don't have an active subscription yet.
                    </p>
                    <Button onClick={() => {
                      onOpenChange(false);
                      navigate('/access-denied');
                    }}>
                      View Plans
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

