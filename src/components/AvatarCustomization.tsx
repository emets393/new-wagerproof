import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserCircle } from './UserCircle';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Palette } from 'lucide-react';
import debug from '@/utils/debug';

// Define all available gradients with their display names
const availableGradients = [
  { key: 'A', name: 'Purple Violet', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { key: 'B', name: 'Pink Red', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { key: 'C', name: 'Blue Cyan', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { key: 'D', name: 'Green Turquoise', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { key: 'E', name: 'Rose Gold', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { key: 'F', name: 'Cyan Purple', gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' },
  { key: 'G', name: 'Mint Pink', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { key: 'H', name: 'Orange Coral', gradient: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)' },
  { key: 'I', name: 'Lavender Blue', gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
  { key: 'J', name: 'Mauve Gray', gradient: 'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)' },
  { key: 'K', name: 'Sky Blue', gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
  { key: 'L', name: 'Plum Cream', gradient: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)' },
  { key: 'M', name: 'Coral Pink', gradient: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)' },
  { key: 'N', name: 'Peach Purple', gradient: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)' },
  { key: 'O', name: 'Lilac Blue', gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { key: 'P', name: 'Fuchsia Crimson', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { key: 'Q', name: 'Azure Aqua', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { key: 'R', name: 'Sunset Sky', gradient: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)' },
  { key: 'S', name: 'Magenta Rose', gradient: 'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)' },
  { key: 'T', name: 'Ocean Blue', gradient: 'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)' },
  { key: 'U', name: 'Blush Cream', gradient: 'linear-gradient(135deg, #feada6 0%, #f5efef 100%)' },
  { key: 'V', name: 'Mint Yellow', gradient: 'linear-gradient(135deg, #a1ffce 0%, #faffd1 100%)' },
  { key: 'W', name: 'Peach Coral', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { key: 'X', name: 'Rose Lilac', gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
  { key: 'Y', name: 'Apricot Rose', gradient: 'linear-gradient(135deg, #ffc3a0 0%, #ffafbd 100%)' },
  { key: 'Z', name: 'Crimson Peach', gradient: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)' },
];

export function AvatarCustomization() {
  const { user } = useAuth();
  const [customLetter, setCustomLetter] = useState('');
  const [selectedGradient, setSelectedGradient] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      // Set initial defaults immediately
      const defaultLetter = user.email?.charAt(0).toUpperCase() || 'U';
      if (!customLetter) setCustomLetter(defaultLetter);
      if (!selectedGradient) setSelectedGradient(defaultLetter);
      
      // Then fetch saved preferences which will override if they exist
      fetchAvatarPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAvatarPreferences = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_avatar_preferences')
        .select('custom_letter, gradient_key')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is okay
        debug.error('Error fetching avatar preferences:', error);
        return;
      }

      if (data) {
        // User has saved preferences
        setCustomLetter(data.custom_letter || '');
        setSelectedGradient(data.gradient_key || '');
      } else {
        // No saved preferences - set defaults from user email
        const defaultLetter = user.email?.charAt(0).toUpperCase() || 'U';
        setCustomLetter(defaultLetter);
        setSelectedGradient(defaultLetter);
      }
    } catch (err) {
      debug.error('Exception fetching avatar preferences:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    // Validate letter
    if (!customLetter || customLetter.length !== 1 || !/^[A-Za-z]$/.test(customLetter)) {
      setError('Please enter a single letter (A-Z)');
      return;
    }

    if (!selectedGradient) {
      setError('Please select a color gradient');
      return;
    }

    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const upperLetter = customLetter.toUpperCase();
      
      // Upsert avatar preferences
      const { error: upsertError } = await supabase
        .from('user_avatar_preferences')
        .upsert({
          user_id: user.id,
          custom_letter: upperLetter,
          gradient_key: selectedGradient,
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        debug.error('Error saving avatar preferences:', upsertError);
        setError('Failed to save preferences');
        return;
      }

      setSuccess('Avatar preferences saved successfully!');
      setCustomLetter(upperLetter);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      debug.error('Exception saving avatar preferences:', err);
      setError('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  // Get preview display values
  const previewLetter = customLetter || user?.email?.charAt(0).toUpperCase() || 'U';
  const previewGradient = selectedGradient || user?.email?.charAt(0).toUpperCase() || 'A';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Avatar Customization</CardTitle>
        </div>
        <CardDescription>
          Customize your avatar letter and color gradient
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview */}
        <div className="flex flex-col items-center gap-3 py-4">
          <Label className="text-sm text-muted-foreground">Preview</Label>
          <UserCircle
            userId={user?.id}
            displayName={previewLetter}
            email={previewLetter}
            customLetter={customLetter}
            customGradient={selectedGradient}
            size="xl"
          />
          {selectedGradient && (
            <div 
              className="w-32 h-2 rounded-full"
              style={{ 
                background: availableGradients.find(g => g.key === selectedGradient)?.gradient 
              }}
            />
          )}
        </div>

        {/* Letter Input */}
        <div className="space-y-2">
          <Label htmlFor="avatar-letter">Avatar Letter</Label>
          <Input
            id="avatar-letter"
            type="text"
            value={customLetter}
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              if (value.length <= 1 && /^[A-Za-z]*$/.test(value)) {
                setCustomLetter(value);
              }
            }}
            placeholder="Enter a letter (A-Z)"
            maxLength={1}
            className="text-center text-2xl font-bold"
          />
          <p className="text-xs text-muted-foreground">
            This letter will appear in your avatar circle
          </p>
        </div>

        {/* Gradient Selector */}
        <div className="space-y-2">
          <Label htmlFor="gradient-select">Color Gradient</Label>
          <Select value={selectedGradient} onValueChange={setSelectedGradient}>
            <SelectTrigger id="gradient-select">
              <SelectValue placeholder="Select a color gradient" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {availableGradients.map((grad) => (
                <SelectItem key={grad.key} value={grad.key}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                      style={{ background: grad.gradient }}
                    />
                    <span>{grad.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose from 26 unique color combinations
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
            {success}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <Button
            onClick={handleSavePreferences}
            disabled={isSaving || !customLetter || !selectedGradient}
            className="w-full sm:w-auto"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Avatar Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

