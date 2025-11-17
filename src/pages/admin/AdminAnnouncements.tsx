import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Megaphone, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import debug from '@/utils/debug';

export default function AdminAnnouncements() {
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

  return (
    <div className="min-h-screen relative bg-black/30 backdrop-blur-sm p-6 overflow-hidden rounded-3xl">
      <div className="max-w-[95vw] mx-auto space-y-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl shadow-lg">
            <Megaphone className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">Announcements</h1>
            <p className="text-white/80 mt-1">Manage announcement banners for all users</p>
          </div>
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
      </div>
    </div>
  );
}

