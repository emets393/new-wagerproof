import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { useRevenueCatWeb } from '@/hooks/useRevenueCatWeb';
import { PAYWALL_ROUTE } from '@/lib/routes';
import {
  Bell,
  Bot,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Shield,
  Smartphone,
  Star,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { user, updatePassword, sendPasswordReset, signOut } = useAuth();
  const { adminModeEnabled, toggleAdminMode, canEnableAdminMode } = useAdminMode();
  const { hasProAccess, customerInfo, subscriptionType } = useRevenueCatWeb();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [didCopyUserId, setDidCopyUserId] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const openRoute = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await updatePassword(newPassword);
      if (updateError) setError(updateError.message);
      else {
        setSuccess('Password changed successfully.');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordExpanded(false);
      }
    } catch {
      setError('Failed to change password.');
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
      const { error: resetError } = await sendPasswordReset(user.email);
      if (resetError) setError(resetError.message);
      else setSuccess('Password reset email sent.');
    } catch {
      setError('Failed to send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = () => {
    if (customerInfo?.managementURL) {
      window.open(customerInfo.managementURL, '_blank', 'noopener,noreferrer');
    } else {
      setSuccess('Use the management link in your subscription confirmation email.');
    }
  };

  const handleCopyUserId = async () => {
    if (!user?.id) return;
    await navigator.clipboard.writeText(user.id);
    setDidCopyUserId(true);
    window.setTimeout(() => setDidCopyUserId(false), 1600);
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(860px,94vh)] max-w-xl gap-0 overflow-hidden rounded-[26px] border-white/[0.08] bg-black p-0 text-white shadow-2xl shadow-black/80 [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-white/[0.07] [&>button]:text-white/70 [&>button]:opacity-100 [&>button:hover]:bg-white/10 [&>button:hover]:text-white">
        <DialogHeader className="border-b border-white/[0.07] bg-black px-6 pb-4 pt-6 pr-16">
          <DialogTitle className="text-[28px] font-semibold leading-none tracking-[-0.035em] text-white">Settings</DialogTitle>
          <DialogDescription className="sr-only">Manage WagerProof settings.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-black pb-10 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
          {error && (
            <Alert variant="destructive" className="mx-6 mt-5 border-red-500/25 bg-red-500/10 text-red-300">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mx-6 mt-5 border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <SectionLabel>AI Connector</SectionLabel>
          <FeatureRow
            icon={<Bot className="h-5 w-5" />}
            title="Connect WagerProof to your AI"
            subtitle="Claude, ChatGPT, Gemini, Grok, and Codex"
            action="Connect"
            onClick={() => openRoute('/connect-ai')}
          />

          <div className="mx-6 mt-3 grid grid-cols-2 gap-2.5">
            <HeroButton
              title={hasProAccess ? 'You are Pro' : 'Go Pro Today'}
              subtitle={hasProAccess ? 'Premium picks unlocked' : 'Unlock premium picks'}
              action={hasProAccess ? 'Manage' : 'Upgrade'}
              icon={<CreditCard className="h-5 w-5" />}
              onClick={hasProAccess ? handleManageBilling : () => openRoute(PAYWALL_ROUTE)}
            />
            <HeroButton
              title="Join our Discord"
              subtitle="Picks, updates, and live chat"
              action="Join"
              icon={<MessageCircle className="h-5 w-5" />}
              onClick={() => openRoute('/discord')}
            />
          </div>

          <SectionLabel>Preferences</SectionLabel>
          <SettingsGroup>
            <SettingsRow
              icon={<Bell />}
              title="Push Notifications"
              subtitle={pushNotifications ? 'On — agent picks & alerts' : 'Off'}
              trailing={<Switch checked={pushNotifications} onCheckedChange={setPushNotifications} aria-label="Push Notifications" />}
            />
            <SettingsRow
              icon={<Mail />}
              title="Email Notifications"
              subtitle={emailNotifications ? 'On — product and account updates' : 'Off'}
              trailing={<Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} aria-label="Email Notifications" />}
            />
            <SettingsRow
              icon={<Smartphone />}
              title="Mobile Apps"
              trailing={<ExternalLink className="h-3.5 w-3.5" />}
              onClick={() => window.open('https://wagerproof.bet/mobile-app', '_blank', 'noopener,noreferrer')}
            />
            {canEnableAdminMode && (
              <SettingsRow
                icon={<Shield />}
                title="Admin Mode"
                subtitle="Enable admin-only features"
                trailing={<Switch checked={adminModeEnabled} onCheckedChange={toggleAdminMode} aria-label="Admin Mode" />}
              />
            )}
            {adminModeEnabled && (
              <SettingsRow
                icon={<LogIn />}
                title="Test Onboarding"
                trailing={<ChevronRight className="h-4 w-4" />}
                onClick={() => openRoute('/onboarding')}
              />
            )}
          </SettingsGroup>

          <SectionLabel>Support</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon={<MessageCircle />} title="Discord Channel" trailing={<ChevronRight className="h-4 w-4" />} onClick={() => openRoute('/discord')} />
            <SettingsRow icon={<Mail />} title="Contact Us" trailing={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => window.location.assign('mailto:admin@wagerproof.bet?subject=Contact%20Us%20-%20WagerProof')} />
            <SettingsRow icon={<Star />} title="Rate WagerProof" subtitle="Leave a review on the App Store" trailing={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => window.open('https://apps.apple.com/app/id6757089957?action=write-review', '_blank', 'noopener,noreferrer')} />
          </SettingsGroup>

          <SectionLabel>Legal</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon={<Shield />} title="Privacy Policy" trailing={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openRoute('/privacy-policy')} />
            <SettingsRow icon={<FileText />} title="Terms of Use" trailing={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => openRoute('/terms-and-conditions')} />
          </SettingsGroup>

          <SectionLabel>Account</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon={<Mail />} title="Email" subtitle={user?.email || '—'} />
            <SettingsRow
              icon={<Hash />}
              title="User ID"
              subtitle={user?.id || '—'}
              trailing={didCopyUserId ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400"><Check className="h-3.5 w-3.5" />Copied</span> : <Copy className="h-3.5 w-3.5" />}
              onClick={handleCopyUserId}
              monoSubtitle
            />
            <SettingsRow icon={<Lock />} title="Change Password" trailing={<ChevronRight className="h-4 w-4" />} onClick={() => setPasswordExpanded((value) => !value)} />
            {passwordExpanded && (
              <div className="space-y-3 border-t border-white/[0.07] px-6 py-5">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs text-white/55">New password</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/25" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs text-white/55">Confirm new password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-white placeholder:text-white/25" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleChangePassword} disabled={isLoading} className="h-10 flex-1 rounded-xl bg-white text-black hover:bg-white/90">
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Change Password
                  </Button>
                  <Button onClick={handlePasswordReset} disabled={isLoading} variant="outline" className="h-10 flex-1 rounded-xl border-white/10 bg-white/[0.06] text-white hover:bg-white/10 hover:text-white">Reset Email</Button>
                </div>
              </div>
            )}
            <SettingsRow
              icon={<CreditCard />}
              title="Subscription"
              subtitle={hasProAccess ? `WagerProof Pro${subscriptionType ? ` · ${subscriptionType}` : ''}` : 'Free plan'}
              trailing={<ChevronRight className="h-4 w-4" />}
              onClick={hasProAccess ? handleManageBilling : () => openRoute(PAYWALL_ROUTE)}
            />
          </SettingsGroup>

          <SectionLabel>More</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon={<LogOut />} title="Sign out" onClick={handleSignOut} />
          </SettingsGroup>

          <SectionLabel destructive>Danger Zone</SectionLabel>
          <SettingsGroup>
            <SettingsRow icon={<Trash2 />} title="Delete Account" subtitle="Permanently delete your account and data" destructive />
          </SettingsGroup>

          <div className="px-6 pb-2 pt-12 text-center text-[11px] leading-5 tracking-[0.02em] text-white/25">
            <p>WagerProof Web</p>
            <p>Developed by nerds from Ohio.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children, destructive = false }: { children: ReactNode; destructive?: boolean }) {
  return <h2 className={`px-6 pb-2 pt-7 text-[13px] font-normal tracking-[0.01em] ${destructive ? 'text-red-400/80' : 'text-white/38'}`}>{children}</h2>;
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <div className="mx-6 divide-y divide-white/[0.07]">{children}</div>;
}

function SettingsRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  destructive = false,
  monoSubtitle = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  monoSubtitle?: boolean;
}) {
  const content = (
    <>
      <span className={`flex w-6 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5 [&>svg]:stroke-[1.7] ${destructive ? 'text-red-400' : 'text-white/48'}`}>{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-[15px] font-normal leading-5 ${destructive ? 'text-red-400' : 'text-white/90'}`}>{title}</span>
        {subtitle && <span className={`mt-0.5 block truncate text-[11px] leading-4 text-white/32 ${monoSubtitle ? 'font-mono' : ''}`}>{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-white/28">{trailing}</span>}
    </>
  );

  const className = "flex min-h-[54px] w-full items-center gap-3.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/60";
  return onClick ? <button type="button" onClick={onClick} className={`${className} hover:bg-white/[0.025]`}>{content}</button> : <div className={className}>{content}</div>;
}

function FeatureRow({ icon, title, subtitle, action, onClick }: { icon: ReactNode; title: string; subtitle: string; action: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mx-6 flex w-[calc(100%-3rem)] items-center gap-3.5 rounded-[18px] border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-left transition hover:bg-white/[0.06] active:scale-[0.99]">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/70">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-white/90">{title}</span><span className="mt-0.5 block truncate text-[11px] text-white/35">{subtitle}</span></span>
      <span className="text-xs font-semibold text-emerald-400">{action}</span>
    </button>
  );
}

function HeroButton({ title, subtitle, action, icon, onClick }: { title: string; subtitle: string; action: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-w-0 rounded-[18px] border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.02] p-4 text-left transition hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.98]">
      <span className="mb-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/55">{icon}</span>
      <span className="block truncate text-sm font-medium text-white/90">{title}</span>
      <span className="mt-0.5 block truncate text-[10px] text-white/32">{subtitle}</span>
      <span className="mt-3 block text-[11px] font-semibold text-emerald-400">{action} →</span>
    </button>
  );
}
