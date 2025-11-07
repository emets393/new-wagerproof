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
import { createCustomerPortalSession } from '@/lib/stripe';
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
  ExternalLink,
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

  const handleManageBilling = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      await createCustomerPortalSession(user.id);
    } catch (err) {
      setError('Failed to open billing portal');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
          <TabsContent value="billing" className="space-y-4 mt-4 relative">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <span className="text-2xl font-bold text-muted-foreground">Coming Soon</span>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>
                  Manage your subscription and billing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Crown className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Pro Plan</h3>
                    <p className="text-sm text-muted-foreground">
                      Full access to all features
                    </p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-bold">$59.99</span>
                      <span className="text-muted-foreground">/month</span>
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
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Next billing date</span>
                    <span className="font-medium">November 13, 2025</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Payment method</span>
                    <span className="flex items-center gap-1 font-medium">
                      <CreditCard className="h-4 w-4" />
                      •••• 4242
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={handleManageBilling} 
                    disabled={isLoading}
                    className="w-full"
                    variant="outline"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Manage Billing with Stripe
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Billing History</CardTitle>
                <CardDescription>
                  View your past invoices and payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">October 2025</p>
                      <p className="text-sm text-muted-foreground">Paid on Oct 13, 2025</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$59.99</p>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">September 2025</p>
                      <p className="text-sm text-muted-foreground">Paid on Sep 13, 2025</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$59.99</p>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">August 2025</p>
                      <p className="text-sm text-muted-foreground">Paid on Aug 13, 2025</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">$59.99</p>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

