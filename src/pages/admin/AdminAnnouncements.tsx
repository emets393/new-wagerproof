import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Megaphone, Loader2, Image, Link as LinkIcon, Type } from "lucide-react";
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
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementPublished, setAnnouncementPublished] = useState(false);
  const [announcementImageUrl, setAnnouncementImageUrl] = useState('');
  const [announcementLinkUrl, setAnnouncementLinkUrl] = useState('');
  const [announcementLinkText, setAnnouncementLinkText] = useState('Learn More');

  // Load announcement banner data
  useEffect(() => {
    if (settings) {
      setAnnouncementTitle(settings.announcement_title || '');
      setAnnouncementMessage(settings.announcement_message || '');
      setAnnouncementPublished(settings.announcement_published || false);
      setAnnouncementImageUrl(settings.announcement_image_url || '');
      setAnnouncementLinkUrl(settings.announcement_link_url || '');
      setAnnouncementLinkText(settings.announcement_link_text || 'Learn More');
    }
  }, [settings]);

  // Update announcement banner mutation
  const updateAnnouncementBanner = useMutation({
    mutationFn: async (params: {
      title: string;
      message: string;
      published: boolean;
      image_url: string;
      link_url: string;
      link_text: string;
    }) => {
      const { data, error } = await supabase
        .rpc('update_announcement_banner', {
          p_title: params.title || null,
          p_message: params.message || null,
          p_published: params.published,
          p_image_url: params.image_url || null,
          p_link_url: params.link_url || null,
          p_link_text: params.link_text || 'Learn More',
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['announcement-banner'] });
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
              Display a rich announcement banner at the top of the app for all users. Add a title, message, background image, and call-to-action link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <Type className="w-4 h-4 text-white/60" />
                Banner Title
                <span className="text-white/40 text-xs">(optional)</span>
              </label>
              <Input
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="e.g. March Madness Special"
                className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Banner Message</label>
              <Textarea
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="Enter the announcement message to display to all users..."
                className="min-h-[100px] bg-black/20 border-white/20 text-white placeholder:text-white/50"
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex items-center gap-2">
                <Image className="w-4 h-4 text-white/60" />
                Background Image URL
                <span className="text-white/40 text-xs">(optional)</span>
              </label>
              <Input
                value={announcementImageUrl}
                onChange={(e) => setAnnouncementImageUrl(e.target.value)}
                placeholder="https://example.com/banner-image.jpg"
                className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
              />
              {announcementImageUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-white/10 h-24">
                  <img
                    src={announcementImageUrl}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Link URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-white/60" />
                  CTA Link URL
                  <span className="text-white/40 text-xs">(optional)</span>
                </label>
                <Input
                  value={announcementLinkUrl}
                  onChange={(e) => setAnnouncementLinkUrl(e.target.value)}
                  placeholder="https://example.com/promo"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">CTA Button Text</label>
                <Input
                  value={announcementLinkText}
                  onChange={(e) => setAnnouncementLinkText(e.target.value)}
                  placeholder="Learn More"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>

            {/* Publish toggle */}
            <div className="flex items-center justify-between pt-2">
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
                title: announcementTitle,
                message: announcementMessage,
                published: announcementPublished,
                image_url: announcementImageUrl,
                link_url: announcementLinkUrl,
                link_text: announcementLinkText,
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

            {/* Live Preview */}
            {announcementMessage && (
              <div className="space-y-2">
                <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Live Preview</p>
                <div
                  className={`relative overflow-hidden rounded-2xl ${
                    announcementImageUrl
                      ? ''
                      : 'bg-gradient-to-br from-green-600/20 via-emerald-600/15 to-teal-600/20 border border-green-500/30'
                  }`}
                >
                  {announcementImageUrl && (
                    <>
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${announcementImageUrl})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />
                    </>
                  )}
                  <div className="relative z-10 px-5 py-4">
                    {announcementTitle && (
                      <p className="text-sm font-bold text-white tracking-tight">{announcementTitle}</p>
                    )}
                    <p className={`text-sm text-white/90 ${announcementTitle ? 'mt-0.5' : ''}`}>
                      {announcementMessage}
                    </p>
                    {announcementLinkUrl && (
                      <span className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-semibold">
                        {announcementLinkText || 'Learn More'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
