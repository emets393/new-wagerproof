import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings as SettingsIcon, Loader2, Eye, Shield, Users, TrendingUp } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import debug from '@/utils/debug';
import { SaleModeToggle } from "@/components/admin/SaleModeToggle";
import { SandboxModeToggle } from "@/components/admin/SandboxModeToggle";
import { useDisplaySettings } from "@/hooks/useDisplaySettings";

export default function AdminSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const { displaySettings, showNFLMoneylinePills, showExtraValueSuggestions, updateDisplaySettings, isUpdating: displaySettingsUpdating } = useDisplaySettings();

  // Check if user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });

      if (error) {
        debug.error('Error checking admin status:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data || false);
      }
      setCheckingAdmin(false);
    }

    checkAdminStatus();
  }, [user]);

  // Fetch site settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin
  });

  // Fetch all users with their roles for stats
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      debug.log('Fetching admin user data...');
      
      const { data: userData, error: userDataError } = await supabase
        .rpc('get_admin_user_data');
      
      if (userDataError) {
        debug.error('Error fetching user data from RPC:', userDataError);
        throw userDataError;
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) {
        debug.error('Error fetching roles:', rolesError);
        throw rolesError;
      }

      if (!userData || userData.length === 0) {
        return [];
      }

      return userData.map((user: any) => ({
        ...user,
        roles: roles.filter(r => r.user_id === user.user_id).map(r => r.role)
      }));
    },
    enabled: isAdmin,
  });

  // State for setting change confirmation dialogs
  const [launchModeDialogOpen, setLaunchModeDialogOpen] = useState(false);
  const [pendingLaunchMode, setPendingLaunchMode] = useState<boolean | null>(null);
  const [accessRestrictedDialogOpen, setAccessRestrictedDialogOpen] = useState(false);
  const [pendingAccessRestricted, setPendingAccessRestricted] = useState<boolean | null>(null);

  // Toggle access restricted mutation
  const toggleAccessRestricted = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!settings?.id) {
        throw new Error('Settings not loaded. Please refresh the page and try again.');
      }
      
      debug.log('Updating access_restricted to:', newValue, 'for settings id:', settings.id);
      
      const { error } = await supabase
        .from('site_settings')
        .update({ 
          access_restricted: newValue,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', settings.id);
      
      if (error) {
        debug.error('Error updating access_restricted:', error);
        throw error;
      }
    },
    onSuccess: () => {
      debug.log('Access restricted setting updated successfully');
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success(`Access restricted ${settings?.access_restricted ? 'disabled' : 'enabled'} successfully`);
      setAccessRestrictedDialogOpen(false);
      setPendingAccessRestricted(null);
    },
    onError: (error: any) => {
      debug.error('Mutation error:', error);
      toast.error('Failed to update access restricted setting: ' + (error?.message || 'Unknown error'));
      setAccessRestrictedDialogOpen(false);
      setPendingAccessRestricted(null);
    }
  });

  // Toggle launch mode mutation
  const toggleLaunchMode = useMutation({
    mutationFn: async (newMode: boolean) => {
      const { error } = await supabase
        .from('site_settings')
        .update({ 
          launch_mode: newMode,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', settings?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success(`Launch mode ${settings?.launch_mode ? 'disabled' : 'enabled'} successfully`);
      setLaunchModeDialogOpen(false);
      setPendingLaunchMode(null);
    },
    onError: (error) => {
      toast.error('Failed to update launch mode: ' + error.message);
      setLaunchModeDialogOpen(false);
      setPendingLaunchMode(null);
    }
  });

  const handleLaunchModeToggle = (checked: boolean) => {
    setPendingLaunchMode(checked);
    setLaunchModeDialogOpen(true);
  };

  const handleAccessRestrictedToggle = (checked: boolean) => {
    setPendingAccessRestricted(checked);
    setAccessRestrictedDialogOpen(true);
  };

  const handleDisplaySettingsToggle = (showMoneyline: boolean, showValueSuggestions: boolean) => {
    updateDisplaySettings({ 
      showMoneyline, 
      showValueSuggestions 
    }, {
      onSuccess: () => {
        toast.success('Display settings updated successfully');
      },
      onError: (error: any) => {
        toast.error('Failed to update display settings: ' + (error?.message || 'Unknown error'));
      }
    });
  };

  const handleViewPaywall = () => {
    window.open('/onboarding?step=16', '_blank');
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/home" replace />;
  }

  const totalUsers = users?.length || 0;
  const freeUsers = users?.filter(u => u.roles.includes('free_user')).length || 0;
  const adminUsers = users?.filter(u => u.roles.includes('admin')).length || 0;
  const paidSubscribers = users?.filter(u => u.subscription_active === true).length || 0;

  return (
    <div className="min-h-screen relative bg-black/30 backdrop-blur-sm p-6 overflow-hidden rounded-3xl">
      <div className="max-w-[95vw] mx-auto space-y-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl shadow-lg">
            <Shield className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">Admin Dashboard</h1>
            <p className="text-white/80 mt-1">Manage WagerProof access and settings</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card
            className="border-white/20 hover:scale-105 transition-all duration-200"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Users</CardTitle>
              <Users className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card
            className="border-white/20 hover:scale-105 transition-all duration-200"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Free Users</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{freeUsers}</div>
            </CardContent>
          </Card>

          <Card
            className="border-white/20 hover:scale-105 transition-all duration-200"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Admins</CardTitle>
              <Shield className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{adminUsers}</div>
            </CardContent>
          </Card>

          <Card
            className="border-white/20 hover:scale-105 transition-all duration-200"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Paid Subscribers</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{paidSubscribers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Site Settings */}
        <Card
          className="border-white/20"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <SettingsIcon className="w-5 h-5" />
              Site Settings
            </CardTitle>
            <CardDescription className="text-white/70">
              Control access modes and subscription requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Launch Mode Toggle */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-medium text-white">Launch Mode (Free Access)</p>
                  {settings?.launch_mode ? (
                    <Badge className="bg-green-500 text-white">FREE MODE ACTIVE</Badge>
                  ) : (
                    <Badge className="bg-blue-600 text-white">PAID MODE ACTIVE</Badge>
                  )}
                </div>
                <p className="text-sm text-white/70">
                  {settings?.launch_mode 
                    ? 'All users currently have free access and skip the paywall.'
                    : 'Users must have an active subscription to access the app.'}
                </p>
                <p className="text-xs text-yellow-400/80 mt-1">
                  {settings?.launch_mode 
                    ? '⚠️ Turning this OFF will require all users to have subscriptions'
                    : '⚠️ Turning this ON will give all users free access'}
                </p>
              </div>
              <Switch
                checked={settings?.launch_mode || false}
                onCheckedChange={handleLaunchModeToggle}
                disabled={settingsLoading || toggleLaunchMode.isPending}
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-700"
              />
            </div>

            {/* Access Restricted Password Overlay Toggle */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-medium text-white">Access Restricted Password Overlay</p>
                  {settings?.access_restricted ? (
                    <Badge className="bg-orange-500 text-white">PASSWORD REQUIRED</Badge>
                  ) : (
                    <Badge className="bg-gray-600 text-white">DIRECT ACCESS</Badge>
                  )}
                </div>
                <p className="text-sm text-white/70">
                  {settings?.access_restricted
                    ? 'Users must enter a password before accessing the login page.'
                    : 'Users can access the login page directly without a password.'}
                </p>
                <p className="text-xs text-yellow-400/80 mt-1">
                  {settings?.access_restricted
                    ? '⚠️ Turning this OFF will allow direct login access'
                    : '⚠️ Turning this ON will require password before login'}
                </p>
              </div>
              <Switch
                checked={settings?.access_restricted ?? true}
                onCheckedChange={handleAccessRestrictedToggle}
                disabled={settingsLoading || toggleAccessRestricted.isPending}
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-700"
              />
            </div>

            {/* Paywall Test Button */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <p className="font-medium text-white">Test Paywall</p>
                <p className="text-sm text-white/70">
                  Preview the paywall design in a new window for testing and validation.
                </p>
              </div>
              <Button
                onClick={handleViewPaywall}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-white/20 hover:bg-white/10 text-white bg-transparent"
              >
                <Eye className="w-4 h-4" />
                View Paywall
              </Button>
            </div>

            {/* NFL Moneyline Pills Toggle */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-medium text-white">Show NFL Moneyline Pills</p>
                  {showNFLMoneylinePills ? (
                    <Badge className="bg-green-500 text-white">VISIBLE</Badge>
                  ) : (
                    <Badge className="bg-gray-600 text-white">HIDDEN</Badge>
                  )}
                </div>
                <p className="text-sm text-white/70">
                  {showNFLMoneylinePills
                    ? 'NFL moneyline values are displayed in the card view.'
                    : 'NFL moneyline values are hidden from the card view.'}
                </p>
              </div>
              <Switch
                checked={showNFLMoneylinePills}
                onCheckedChange={(checked) => handleDisplaySettingsToggle(checked, showExtraValueSuggestions)}
                disabled={displaySettingsUpdating}
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-700"
              />
            </div>

            {/* Extra Value Suggestions Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-medium text-white">Show Extra Value Suggestions</p>
                  {showExtraValueSuggestions ? (
                    <Badge className="bg-green-500 text-white">VISIBLE</Badge>
                  ) : (
                    <Badge className="bg-gray-600 text-white">HIDDEN</Badge>
                  )}
                </div>
                <p className="text-sm text-white/70">
                  {showExtraValueSuggestions
                    ? 'Extra value suggestions are shown in Editors Picks.'
                    : 'Extra value suggestions are hidden from Editors Picks.'}
                </p>
              </div>
              <Switch
                checked={showExtraValueSuggestions}
                onCheckedChange={(checked) => handleDisplaySettingsToggle(showNFLMoneylinePills, checked)}
                disabled={displaySettingsUpdating}
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-700"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sale Mode Toggle */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
          }}
          className="rounded-xl border border-white/20"
        >
          <SaleModeToggle />
        </div>

        {/* Sandbox Mode Toggle */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
          }}
          className="rounded-xl border border-white/20"
        >
          <SandboxModeToggle />
        </div>

        {/* Launch Mode Confirmation Dialog */}
        <AlertDialog open={launchModeDialogOpen} onOpenChange={setLaunchModeDialogOpen}>
          <AlertDialogContent className="bg-black/90 border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {pendingLaunchMode ? 'Enable Free Access Mode?' : 'Disable Free Access Mode?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                {pendingLaunchMode ? (
                  <>
                    <strong className="text-yellow-400">⚠️ WARNING:</strong> This will enable <strong>FREE ACCESS MODE</strong> for all users.
                    <br /><br />
                    All users will be able to access the app without a subscription. This bypasses the paywall completely.
                    <br /><br />
                    Are you sure you want to enable free access for everyone?
                  </>
                ) : (
                  <>
                    <strong className="text-yellow-400">⚠️ WARNING:</strong> This will enable <strong>PAID MODE</strong>.
                    <br /><br />
                    All users will be required to have an active subscription to access the app. Users without subscriptions will be blocked.
                    <br /><br />
                    Are you sure you want to require subscriptions for all users?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingLaunchMode !== null) {
                    toggleLaunchMode.mutate(pendingLaunchMode);
                  }
                }}
                className={pendingLaunchMode ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
                disabled={toggleLaunchMode.isPending}
              >
                {toggleLaunchMode.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  pendingLaunchMode ? 'Enable Free Access' : 'Enable Paid Mode'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Access Restricted Confirmation Dialog */}
        <AlertDialog open={accessRestrictedDialogOpen} onOpenChange={setAccessRestrictedDialogOpen}>
          <AlertDialogContent className="bg-black/90 border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {pendingAccessRestricted ? 'Enable Password Overlay?' : 'Disable Password Overlay?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                {pendingAccessRestricted ? (
                  <>
                    <strong className="text-yellow-400">⚠️ WARNING:</strong> This will enable the <strong>PASSWORD OVERLAY</strong>.
                    <br /><br />
                    Users will be required to enter a password before accessing the login page. This adds an extra security layer.
                    <br /><br />
                    Are you sure you want to require a password before login?
                  </>
                ) : (
                  <>
                    <strong className="text-yellow-400">⚠️ WARNING:</strong> This will disable the <strong>PASSWORD OVERLAY</strong>.
                    <br /><br />
                    Users will be able to access the login page directly without entering a password first.
                    <br /><br />
                    Are you sure you want to allow direct login access?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingAccessRestricted !== null) {
                    toggleAccessRestricted.mutate(pendingAccessRestricted);
                  }
                }}
                className={pendingAccessRestricted ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-gray-600 hover:bg-gray-700 text-white"}
                disabled={toggleAccessRestricted.isPending}
              >
                {toggleAccessRestricted.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  pendingAccessRestricted ? 'Enable Password Overlay' : 'Disable Password Overlay'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

