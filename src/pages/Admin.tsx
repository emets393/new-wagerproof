import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, TrendingUp, Settings as SettingsIcon, Loader2, Eye, MoreVertical, Trash2, Megaphone, Search, Filter, X, Gift, RefreshCw } from "lucide-react";
import { Navigate } from "react-router-dom";
import debug from '@/utils/debug';
import Dither from "@/components/Dither";
import { SaleModeToggle } from "@/components/admin/SaleModeToggle";
import { SandboxModeToggle } from "@/components/admin/SandboxModeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { useDisplaySettings } from "@/hooks/useDisplaySettings";
import { grantEntitlement, syncRevenueCatUser, EntitlementDuration, getEndTimeMs } from "@/utils/revenuecatAdmin";
import { ENTITLEMENT_IDENTIFIER } from "@/services/revenuecatWeb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

export default function Admin() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
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

  // Fetch all users with their roles and additional data
  const { data: users, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    staleTime: 0, // Always consider data stale so refetches work immediately
    queryFn: async () => {
      debug.log('Fetching admin user data...');
      
      // Get user data including email from RPC function
      const { data: userData, error: userDataError } = await supabase
        .rpc('get_admin_user_data');
      
      if (userDataError) {
        debug.error('Error fetching user data from RPC:', userDataError);
        throw userDataError;
      }

      debug.log('User data received:', userData?.length || 0, 'users');

      // Get roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) {
        debug.error('Error fetching roles:', rolesError);
        throw rolesError;
      }

      debug.log('Roles received:', roles?.length || 0, 'role entries');

      if (!userData || userData.length === 0) {
        debug.warn('No user data returned from RPC function');
        return [];
      }

      return userData.map((user: any) => ({
        ...user,
        roles: roles.filter(r => r.user_id === user.user_id).map(r => r.role)
      }));
    },
    enabled: isAdmin,
    retry: 1
  });

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ user_id: string; email: string; username: string } | null>(null);

  // State for grant entitlement dialog
  const [grantEntitlementDialogOpen, setGrantEntitlementDialogOpen] = useState(false);
  const [userToGrant, setUserToGrant] = useState<{ user_id: string; email: string; username: string; revenuecat_customer_id: string | null } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<EntitlementDuration>('monthly');
  const [customExpirationDate, setCustomExpirationDate] = useState<Date | undefined>(undefined);

  // State for tracking syncing user
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);

  // State for setting change confirmation dialogs
  const [launchModeDialogOpen, setLaunchModeDialogOpen] = useState(false);
  const [pendingLaunchMode, setPendingLaunchMode] = useState<boolean | null>(null);
  const [accessRestrictedDialogOpen, setAccessRestrictedDialogOpen] = useState(false);
  const [pendingAccessRestricted, setPendingAccessRestricted] = useState<boolean | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');

  // Filter users based on search and filters
  const filteredUsers = users?.filter((user) => {
    // Search filter - search across username, email, display_name, and revenuecat_customer_id
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.revenuecat_customer_id?.toLowerCase().includes(searchLower);

    // Role filter
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);

    // Subscription filter
    let matchesSubscription = true;
    if (subscriptionFilter === 'active') {
      matchesSubscription = user.subscription_active === true;
    } else if (subscriptionFilter === 'inactive') {
      matchesSubscription = user.subscription_active === false || !user.subscription_active;
    }

    return matchesSearch && matchesRole && matchesSubscription;
  }) || [];

  // Delete user account mutation
  const deleteUserAccount = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data, error } = await supabase
        .rpc('delete_user_account', { target_user_id: targetUserId });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User account deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error('Failed to delete user account: ' + (error?.message || 'Unknown error'));
    }
  });

  // Sync RevenueCat data mutation
  const syncRevenueCatMutation = useMutation({
    mutationFn: async (userId: string) => {
      setSyncingUserId(userId);
      const result = await syncRevenueCatUser(userId, ENTITLEMENT_IDENTIFIER);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync RevenueCat data');
      }
      
      return result;
    },
    onSuccess: async (result, userId) => {
      debug.log('RevenueCat data synced successfully:', result);
      debug.log('Synced data:', result.data);
      
      toast.success('Syncing from RevenueCat...');
      
      // Wait a bit for database to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      debug.log('Invalidating and refetching admin-users query...');
      
      // Remove all cached data for admin-users
      queryClient.removeQueries({ queryKey: ['admin-users'] });
      
      // Force immediate refetch
      const refetchResult = await queryClient.fetchQuery({ 
        queryKey: ['admin-users'],
        queryFn: async () => {
          debug.log('Force fetching admin user data...');
          
          const { data: userData, error: userDataError } = await supabase
            .rpc('get_admin_user_data');
          
          if (userDataError) {
            debug.error('Error fetching user data from RPC:', userDataError);
            throw userDataError;
          }

          debug.log('Fetched user data:', userData?.length || 0, 'users');

          const { data: roles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, role');
          
          if (rolesError) {
            debug.error('Error fetching roles:', rolesError);
            throw rolesError;
          }

          if (!userData || userData.length === 0) {
            debug.warn('No user data returned from RPC function');
            return [];
          }

          return userData.map((user: any) => ({
            ...user,
            roles: roles.filter(r => r.user_id === user.user_id).map(r => r.role)
          }));
        },
        staleTime: 0,
      });
      
      debug.log('Refetch complete, new data:', refetchResult);
      
      // Find the synced user in the new data
      const syncedUser = refetchResult?.find((u: any) => u.user_id === userId);
      if (syncedUser) {
        debug.log('Updated user data:', {
          user_id: syncedUser.user_id,
          subscription_active: syncedUser.subscription_active,
          subscription_status: syncedUser.subscription_status,
          subscription_expires_at: syncedUser.subscription_expires_at,
        });
      } else {
        debug.warn('Could not find synced user in refetched data');
      }
      
      setSyncingUserId(null);
      toast.success('RevenueCat data synced! User table updated.');
    },
    onError: (error: any, userId) => {
      setSyncingUserId(null);
      const errorMsg = error?.message || 'Unknown error';
      toast.error('Failed to sync RevenueCat data: ' + errorMsg);
      debug.error('Sync RevenueCat error:', error);
    }
  });

  // Grant entitlement mutation
  const grantEntitlementMutation = useMutation({
    mutationFn: async ({ userId, duration, endTimeMs }: { userId: string; duration: EntitlementDuration; endTimeMs?: number }) => {
      const result = await grantEntitlement({
        app_user_id: userId,
        entitlement_identifier: ENTITLEMENT_IDENTIFIER,
        duration,
        end_time_ms: endTimeMs,
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to grant entitlement');
      }
      
      return result;
    },
    onSuccess: async (result) => {
      debug.log('Entitlement granted successfully:', result);
      
      toast.success('Entitlement granted! Refreshing user data...');
      
      // Add a delay to ensure RevenueCat and Supabase sync is complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Force invalidate and refetch of user data to show updated entitlement
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      
      // Wait for the refetch to complete
      try {
        await queryClient.refetchQueries({ 
          queryKey: ['admin-users'],
          type: 'active'
        });
        debug.log('User data refetched successfully');
        toast.success('Entitlement granted successfully! The user can now access the app.');
      } catch (refetchError) {
        debug.error('Error refetching user data:', refetchError);
        toast.info('Entitlement granted! Refresh the page to see the update.');
      }
      
      setGrantEntitlementDialogOpen(false);
      setUserToGrant(null);
      setSelectedDuration('monthly');
      setCustomExpirationDate(undefined);
    },
    onError: (error: any) => {
      toast.error('Failed to grant entitlement: ' + (error?.message || 'Unknown error'));
      debug.error('Grant entitlement error:', error);
    }
  });

  // Announcements banner state
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementPublished, setAnnouncementPublished] = useState(false);

  // Load announcement banner data
  useEffect(() => {
    if (settings) {
      setAnnouncementMessage(settings.announcement_message || '');
      setAnnouncementPublished(settings.announcement_published || false);
    }
  }, [settings]);

  // Update announcement banner mutation
  const updateAnnouncementBanner = useMutation({
    mutationFn: async ({ message, published }: { message: string; published: boolean }) => {
      const { data, error } = await supabase
        .rpc('update_announcement_banner', {
          message: message || null,
          published: published
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      toast.success('Announcement banner updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update announcement banner: ' + (error?.message || 'Unknown error'));
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
    // Open directly to the paywall step (step 16) in a new window for testing
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
      {/* Dither Background Effect */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl" style={{ clipPath: 'inset(0 round 1.5rem)' }}>
        <Dither
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.3}
          waveColor={[0.13, 0.77, 0.37]}
          colorNum={4}
          pixelSize={2}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0}
        />
      </div>

      <div className="relative z-10">
        <div className="max-w-[95vw] mx-auto space-y-8 px-4">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">Admin Dashboard</h1>
              <p className="text-white/80 mt-1">Manage WagerProof access and users</p>
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

          {/* Announcements Banner */}
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
                <Megaphone className="w-5 h-5" />
                Announcements Banner
              </CardTitle>
              <CardDescription className="text-white/70">
                Display a message banner across the top of the app for all users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Banner Message</label>
                <Textarea
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  placeholder="Enter the announcement message to display to all users..."
                  className="min-h-[100px] bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">Publish Banner</p>
                  <p className="text-sm text-white/70">
                    {announcementPublished ? 'Banner is currently visible to all users' : 'Banner is hidden'}
                  </p>
                </div>
                <Switch
                  checked={announcementPublished}
                  onCheckedChange={(checked) => setAnnouncementPublished(checked)}
                  disabled={updateAnnouncementBanner.isPending}
                  className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-700"
                />
              </div>
              <Button
                onClick={() => updateAnnouncementBanner.mutate({ 
                  message: announcementMessage, 
                  published: announcementPublished 
                })}
                disabled={updateAnnouncementBanner.isPending || settingsLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {updateAnnouncementBanner.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Announcement'
                )}
              </Button>
              {announcementPublished && announcementMessage && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-xs text-green-400 mb-1">Preview:</p>
                  <p className="text-sm text-white">{announcementMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* User Management */}
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">User Management</CardTitle>
                  <CardDescription className="text-white/70">
                    View and manage all registered users
                    <span className="block text-xs text-green-400/80 mt-2">
                      ℹ️ Subscription data is cached in Supabase for fast loading. No individual RevenueCat API calls are made per user.
                    </span>
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    debug.log('Manual refresh triggered');
                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                    toast.info('Refreshing user data...');
                  }}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white hover:bg-white/10"
                  disabled={usersLoading}
                >
                  {usersLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter Controls */}
              <div className="mb-6 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
                  <Input
                    type="text"
                    placeholder="Search by username, email, display name, or RevenueCat ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 text-white/50 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap gap-4">
                  {/* Role Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-white/70" />
                    <label className="text-sm text-white/70">Role:</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-md bg-black/20 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    >
                      <option value="all">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="free_user">Free User</option>
                    </select>
                  </div>

                  {/* Subscription Filter */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-white/70">Subscription:</label>
                    <select
                      value={subscriptionFilter}
                      onChange={(e) => setSubscriptionFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-md bg-black/20 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Clear Filters */}
                  {(roleFilter !== 'all' || subscriptionFilter !== 'all' || searchQuery) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setRoleFilter('all');
                        setSubscriptionFilter('all');
                      }}
                      className="text-white/70 hover:text-white"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear Filters
                    </Button>
                  )}

                  {/* Results Count */}
                  <div className="ml-auto text-sm text-white/70">
                    Showing {filteredUsers.length} of {users?.length || 0} users
                  </div>
                </div>
              </div>

              {usersError && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm font-medium">Error loading users:</p>
                  <p className="text-red-300 text-xs mt-1">{usersError.message || 'Unknown error'}</p>
                  <Button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
                    variant="outline"
                    size="sm"
                    className="mt-2 border-red-500/50 text-red-400 hover:bg-red-500/20"
                  >
                    Retry
                  </Button>
                </div>
              )}
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : users && users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-white/70 mb-2">No users found</p>
                  <p className="text-white/50 text-sm">Users will appear here once they register</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-white/70 mb-2">No users match your filters</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setRoleFilter('all');
                      setSubscriptionFilter('all');
                    }}
                    className="mt-2 border-white/20 text-white hover:bg-white/10"
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>RevenueCat ID</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Onboarding</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="w-[50px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium text-white">{user.username}</TableCell>
                          <TableCell className="text-white">{user.email || 'N/A'}</TableCell>
                          <TableCell className="text-white">{user.display_name}</TableCell>
                          <TableCell className="text-white">
                            <span className="font-mono text-xs">
                              {user.revenuecat_customer_id ? (
                                <span className="text-green-400">{user.revenuecat_customer_id}</span>
                              ) : (
                                <span className="text-white/50">N/A</span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.subscription_active ? (
                              <div className="flex flex-col gap-1">
                                <Badge 
                                  variant="default" 
                                  className={
                                    user.subscription_status === 'promotional' 
                                      ? "bg-purple-600 text-white" 
                                      : "bg-green-500 text-white"
                                  }
                                >
                                  {user.subscription_status === 'promotional' 
                                    ? '🎁 Admin Grant' 
                                    : user.subscription_status || 'Active'}
                                </Badge>
                                {user.subscription_status === 'lifetime' && (
                                  <span className="text-xs text-green-400">∞ Lifetime</span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-white bg-gray-700">
                                None
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-white text-sm">
                            {user.subscription_expires_at ? (
                              <div className="flex flex-col">
                                <span>{new Date(user.subscription_expires_at).toLocaleDateString()}</span>
                                <span className="text-xs text-white/50">
                                  {new Date(user.subscription_expires_at) > new Date() 
                                    ? '✓ Active' 
                                    : '⚠ Expired'}
                                </span>
                              </div>
                            ) : user.subscription_status === 'lifetime' ? (
                              <span className="text-green-400 font-semibold">∞ Lifetime</span>
                            ) : (
                              <span className="text-white/50">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {user.roles.map((role) => (
                                <Badge
                                  key={role}
                                  variant={role === 'admin' ? 'default' : 'secondary'}
                                  className={
                                    role === 'admin'
                                      ? "bg-blue-600 text-white"
                                      : "text-white bg-gray-700"
                                  }
                                >
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.onboarding_completed ? (
                              <Badge variant="default" className="bg-green-500 text-white">
                                ✓ 
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-yellow-300 bg-yellow-500/20 border-yellow-500/50">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-white">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-white hover:bg-white/10"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-black/90 border-white/20">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setUserToGrant({
                                      user_id: user.user_id,
                                      email: user.email || user.username,
                                      username: user.username,
                                      revenuecat_customer_id: user.revenuecat_customer_id
                                    });
                                    setGrantEntitlementDialogOpen(true);
                                  }}
                                  className="text-green-400 focus:text-green-300 focus:bg-green-500/20"
                                >
                                  <Gift className="h-4 w-4 mr-2" />
                                  Grant Entitlement
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    debug.log('Syncing RevenueCat data for user:', user.user_id);
                                    syncRevenueCatMutation.mutate(user.user_id);
                                  }}
                                  disabled={syncingUserId === user.user_id}
                                  className="text-blue-400 focus:text-blue-300 focus:bg-blue-500/20"
                                >
                                  {syncingUserId === user.user_id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Syncing...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Sync RevenueCat
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setUserToDelete({
                                      user_id: user.user_id,
                                      email: user.email || user.username,
                                      username: user.username
                                    });
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-red-400 focus:text-red-300 focus:bg-red-500/20"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Grant Entitlement Dialog */}
          <AlertDialog open={grantEntitlementDialogOpen} onOpenChange={setGrantEntitlementDialogOpen}>
            <AlertDialogContent className="bg-black/90 border-white/20 max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Grant Entitlement</AlertDialogTitle>
                <AlertDialogDescription className="text-white/70">
                  Grant "WagerProof Pro" entitlement to <strong>{userToGrant?.email || userToGrant?.username}</strong>
                  {userToGrant?.revenuecat_customer_id ? (
                    <span className="block text-xs text-white/50 mt-1">
                      RevenueCat ID: {userToGrant.revenuecat_customer_id}
                    </span>
                  ) : (
                    <span className="block text-xs text-yellow-400/80 mt-2">
                      ⚠️ User hasn't signed in yet. RevenueCat will create their account automatically.
                    </span>
                  )}
                  <span className="block text-xs text-green-400/80 mt-2">
                    This grants immediate access. The entitlement will appear in the table after granting.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">Duration</label>
                  <Select
                    value={selectedDuration}
                    onValueChange={(value) => {
                      setSelectedDuration(value as EntitlementDuration);
                      if (value !== 'custom') {
                        setCustomExpirationDate(undefined);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-black/20 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-white/20">
                      <SelectItem value="monthly" className="text-white focus:bg-white/10">
                        📅 Monthly (30 days from now)
                      </SelectItem>
                      <SelectItem value="yearly" className="text-white focus:bg-white/10">
                        📆 Yearly (365 days from now)
                      </SelectItem>
                      <SelectItem value="lifetime" className="text-white focus:bg-white/10">
                        ∞ Lifetime (never expires - 99 years)
                      </SelectItem>
                      <SelectItem value="custom" className="text-white focus:bg-white/10">
                        🎯 Custom expiration date
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedDuration === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Expiration Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal bg-black/20 border-white/20 text-white hover:bg-white/10"
                        >
                          {customExpirationDate ? (
                            format(customExpirationDate, "PPP")
                          ) : (
                            <span className="text-white/50">Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-black/90 border-white/20" align="start">
                        <Calendar
                          mode="single"
                          selected={customExpirationDate}
                          onSelect={setCustomExpirationDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="bg-black/90 text-white"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {selectedDuration === 'lifetime' && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400">
                      This will grant a lifetime entitlement with no expiration date.
                    </p>
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (userToGrant) {
                      let endTimeMs: number | undefined = undefined;
                      
                      if (selectedDuration === 'custom' && customExpirationDate) {
                        endTimeMs = getEndTimeMs(customExpirationDate);
                      }
                      // For lifetime, endTimeMs remains undefined
                      
                      grantEntitlementMutation.mutate({
                        userId: userToGrant.user_id,
                        duration: selectedDuration,
                        endTimeMs,
                      });
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={grantEntitlementMutation.isPending || (selectedDuration === 'custom' && !customExpirationDate)}
                >
                  {grantEntitlementMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Granting...
                    </>
                  ) : (
                    'Grant Entitlement'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Account Confirmation Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent className="bg-black/90 border-white/20">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Delete User Account</AlertDialogTitle>
                <AlertDialogDescription className="text-white/70">
                  Are you sure you want to delete the account for <strong>{userToDelete?.email || userToDelete?.username}</strong>?
                  <br /><br />
                  This action cannot be undone. All user data, including profiles, roles, and related information will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (userToDelete) {
                      deleteUserAccount.mutate(userToDelete.user_id);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleteUserAccount.isPending}
                >
                  {deleteUserAccount.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Account'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
