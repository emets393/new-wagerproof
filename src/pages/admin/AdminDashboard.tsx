import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, TrendingUp, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import debug from '@/utils/debug';

export default function AdminDashboard() {
  const { user } = useAuth();
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

  // Fetch all users with their roles and additional data
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
            <p className="text-white/80 mt-1">Overview of WagerProof system</p>
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
      </div>
    </div>
  );
}

