import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, Users, TrendingUp, Settings as SettingsIcon, Loader2, Eye } from "lucide-react";
import { Navigate } from "react-router-dom";
import debug from '@/utils/debug';
import Dither from "@/components/Dither";
import { SaleModeToggle } from "@/components/admin/SaleModeToggle";

export default function Admin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

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

  // Fetch all users with their roles
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, created_at');
      
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      return profiles.map(profile => ({
        ...profile,
        roles: roles.filter(r => r.user_id === profile.user_id).map(r => r.role)
      }));
    },
    enabled: isAdmin
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
      toast.success('Launch mode updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update launch mode: ' + error.message);
    }
  });

  const handleViewPaywall = () => {
    // Open the actual onboarding flow (with paywall) in a new window for testing
    window.open('/onboarding', '_blank');
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
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-accent drop-shadow-lg">Admin Dashboard</h1>
              <p className="text-white/80 mt-1">Manage WagerProof access and users</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div>
                  <p className="font-medium text-white">Launch Mode (Free Access)</p>
                  <p className="text-sm text-white/70">
                    When enabled, all users get free access and skip the paywall. Turn off to require subscriptions.
                  </p>
                </div>
                <Switch
                  checked={settings?.launch_mode || false}
                  onCheckedChange={(checked) => toggleLaunchMode.mutate(checked)}
                  disabled={settingsLoading || toggleLaunchMode.isPending}
                />
              </div>

              {/* Paywall Test Button */}
              <div className="flex items-center justify-between">
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
                  className="flex items-center gap-2 border-white/20 hover:bg-white/10 text-white"
                >
                  <Eye className="w-4 h-4" />
                  View Paywall
                </Button>
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
              <CardTitle className="text-white">User Management</CardTitle>
              <CardDescription className="text-white/70">View and manage all registered users</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium text-white">{user.username}</TableCell>
                        <TableCell className="text-white">{user.display_name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {user.roles.map((role) => (
                              <Badge
                                key={role}
                                variant={role === 'admin' ? 'default' : 'secondary'}
                                className="text-white"
                              >
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
