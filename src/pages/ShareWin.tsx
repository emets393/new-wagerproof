import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle2, Trophy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import debug from "@/utils/debug";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function ShareWin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's past uploads
  const { data: myWins, isLoading: isLoadingWins } = useQuery({
    queryKey: ['my-wins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_wins' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Delete mutation
  const deleteWinMutation = useMutation({
    mutationFn: async (win: any) => {
      // 1. Delete from storage
      // Parse filename from URL or stored path if available. 
      // Assuming the URL structure matches our storage policy: .../user-wins/{user_id}/{filename}
      const url = win.image_url;
      const path = url.split('/user-wins/').pop(); // Extract path after bucket name
      
      if (path) {
        const { error: storageError } = await supabase.storage
          .from('user-wins')
          .remove([path]);
        
        if (storageError) {
          debug.error('Error deleting from storage:', storageError);
          // Continue to delete db record even if storage fails (orphan cleanup)
        }
      }

      // 2. Delete from DB
      const { error } = await supabase
        .from('user_wins' as any)
        .delete()
        .eq('id', win.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-wins'] });
      toast.success("Win deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete win: " + error.message);
    }
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("Image size must be less than 5MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!imageFile) {
      setError("Please select an image to upload");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload image to storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('user-wins')
        .upload(fileName, imageFile, {
          upsert: false,
          contentType: imageFile.type
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-wins')
        .getPublicUrl(fileName);

      // 3. Create database record
      const { error: dbError } = await supabase
        .from('user_wins' as any)
        .insert({
          user_id: user.id,
          image_url: publicUrl,
          caption: caption,
          is_public: isPublic,
          is_featured: false // Default to false, requires admin approval
        });

      if (dbError) throw dbError;

      toast.success("Win shared successfully!", {
        description: "Your win has been submitted and will be reviewed by our team."
      });
      
      // Reset form
      setImageFile(null);
      setImagePreview(null);
      setCaption("");
      setIsPublic(true);
      queryClient.invalidateQueries({ queryKey: ['my-wins'] });
      
    } catch (err: any) {
      debug.error("Error sharing win:", err);
      setError(err.message || "Failed to submit your win. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Upload Section */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-green-500/20 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-500/10 p-3 rounded-full w-fit mb-4">
              <Trophy className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold">Share Your Big Wins</CardTitle>
            <CardDescription>
              Upload your winning bet slips to be featured on our landing page!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="image">Bet Slip Image</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="max-h-64 mx-auto rounded-md shadow-sm" 
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-md text-white font-medium">
                        Click to change
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drag & drop or click to upload image
                      </p>
                      <p className="text-xs text-muted-foreground/75">
                        PNG, JPG up to 5MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="caption">Caption (Optional)</Label>
                <Textarea
                  id="caption"
                  placeholder="Tell us about this win! What made you take this bet?"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="resize-none min-h-[100px]"
                  maxLength={280}
                />
                <div className="text-xs text-right text-muted-foreground">
                  {caption.length}/280
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="public-view" className="text-base">Allow Public Viewing</Label>
                  <p className="text-sm text-muted-foreground">
                    If selected, this win may be featured on our homepage.
                  </p>
                </div>
                <Switch
                  id="public-view"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white" 
                disabled={isSubmitting || !imageFile}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Submit Win
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Gallery Section */}
      {myWins && myWins.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">My Uploads</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {myWins.map((win: any) => (
              <Card key={win.id} className="overflow-hidden border-white/10 bg-card/30 backdrop-blur-sm hover:border-green-500/30 transition-all group">
                <div className="relative aspect-video bg-black/20">
                  <img 
                    src={win.image_url} 
                    alt="Win" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this win?')) {
                          deleteWinMutation.mutate(win);
                        }
                      }}
                      disabled={deleteWinMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                  {win.is_featured && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">Featured</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant={win.is_public ? "outline" : "secondary"} className="text-xs">
                      {win.is_public ? "Public" : "Private"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(win.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {win.caption ? (
                    <p className="text-sm text-muted-foreground line-clamp-2 italic">
                      "{win.caption}"
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic opacity-50">
                      No caption provided
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
