import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import debug from "@/utils/debug";
import { format } from "date-fns";

export default function UserWinsAdmin() {
  const queryClient = useQueryClient();

  // Fetch site settings for the section toggle
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('id, show_user_wins_section')
        .single();
      
      if (error) throw error;
      return data as any;
    }
  });

  // Fetch user wins submissions
  const { data: wins, isLoading: winsLoading } = useQuery({
    queryKey: ['admin-user-wins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wins' as any)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as any[];
    }
  });

  // Toggle site setting
  const toggleSectionMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from('site_settings')
        .update({ show_user_wins_section: newValue } as any)
        .eq('id', settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['landing-show-user-wins'] });
      queryClient.invalidateQueries({ queryKey: ['landing-show-user-wins-feature'] });
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update settings: " + error.message);
    }
  });

  // Toggle featured status
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string, isFeatured: boolean }) => {
      const { error } = await supabase
        .from('user_wins' as any)
        .update({ is_featured: isFeatured })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-wins'] });
      toast.success("Win updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update win: " + error.message);
    }
  });

  // Delete win
  const deleteWinMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_wins' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-wins'] });
      toast.success("Win deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete win: " + error.message);
    }
  });

  const isLoading = settingsLoading || winsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">User Wins Management</h1>
          <p className="text-muted-foreground">Curate and display user wins on the landing page</p>
        </div>
        
        <Card className="w-full sm:w-auto bg-card/50 backdrop-blur-sm border-white/10">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="space-y-0.5">
              <div className="font-medium text-sm text-white">Landing Page Section</div>
              <div className="text-xs text-muted-foreground">
                {settings?.show_user_wins_section ? 'Visible to public' : 'Hidden from public'}
              </div>
            </div>
            <Switch
              checked={settings?.show_user_wins_section || false}
              onCheckedChange={(checked) => toggleSectionMutation.mutate(checked)}
              disabled={toggleSectionMutation.isPending}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {wins?.map((win) => (
          <Card key={win.id} className={`overflow-hidden flex flex-col ${win.is_featured ? 'border-green-500/50 shadow-lg shadow-green-500/10' : 'border-white/10'}`}>
            <div className="relative aspect-[4/3] bg-black/20 group">
              <img 
                src={win.image_url} 
                alt="Win" 
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this win?')) {
                      deleteWinMutation.mutate(win.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
            
            <CardContent className="flex-1 p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={win.is_public ? "outline" : "secondary"} className="text-xs">
                    {win.is_public ? "Public" : "Private"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(win.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                
                {win.caption && (
                  <p className="text-sm text-white/80 line-clamp-3 italic">
                    "{win.caption}"
                  </p>
                )}
                
                <div className="text-xs text-muted-foreground truncate">
                  User: {win.user_id}
                </div>
              </div>

              <div className="pt-2 mt-auto border-t border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">Featured</span>
                  <Switch
                    checked={win.is_featured}
                    onCheckedChange={(checked) => toggleFeaturedMutation.mutate({ id: win.id, isFeatured: checked })}
                    disabled={toggleFeaturedMutation.isPending}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {wins?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-card/20 rounded-xl border border-dashed border-white/10">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white">No wins submitted yet</h3>
            <p className="text-muted-foreground">User submissions will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

