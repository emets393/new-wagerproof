import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bell,
  Loader2,
  Send,
  Smartphone,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  cancelBroadcast,
  countAudience,
  createBroadcastDraft,
  listBroadcasts,
  listRecipientFailures,
  PUSH_DEEP_LINK_ROUTES,
  scheduleBroadcast,
  sendBroadcastNow,
  testSendBroadcast,
  updateBroadcastDraft,
  type AudienceCount,
  type PushBroadcastDraftInput,
  type PushBroadcastStatusRow,
  type PushDeepLinkRoute,
  type PushPlatform,
  type PushSubscriptionFilter,
} from '@/services/pushBroadcastService';

const TITLE_MAX = 65;
const BODY_MAX = 240;

const glassStyle = {
  background: 'rgba(0, 0, 0, 0.3)',
  backdropFilter: 'blur(40px)',
  WebkitBackdropFilter: 'blur(40px)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)',
} as const;

function toDraftInput(state: {
  title: string;
  body: string;
  route: PushDeepLinkRoute;
  platforms: PushPlatform[];
  subscription: PushSubscriptionFilter;
}): PushBroadcastDraftInput {
  return {
    title: state.title,
    body: state.body,
    deep_link_route: state.route,
    target_platforms: state.platforms,
    target_subscription: state.subscription,
  };
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-white/10 text-white/80',
    scheduled: 'bg-blue-500/20 text-blue-200',
    queued: 'bg-amber-500/20 text-amber-200',
    sending: 'bg-amber-500/20 text-amber-200',
    sent: 'bg-green-500/20 text-green-200',
    canceled: 'bg-white/10 text-white/50',
    failed: 'bg-red-500/20 text-red-200',
  };
  return <Badge className={map[status] || 'bg-white/10 text-white/80'}>{status}</Badge>;
}

export default function AdminPushBroadcasts() {
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState<PushDeepLinkRoute>('feed');
  const [platforms, setPlatforms] = useState<PushPlatform[]>(['ios', 'android']);
  const [subscription, setSubscription] = useState<PushSubscriptionFilter>('all');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [failureId, setFailureId] = useState<string | null>(null);
  const [audience, setAudience] = useState<AudienceCount | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);

  const draft = useMemo(
    () => toDraftInput({ title, body, route, platforms, subscription }),
    [title, body, route, platforms, subscription],
  );

  const listQuery = useQuery({
    queryKey: ['admin', 'push-broadcasts'],
    queryFn: listBroadcasts,
    enabled: isAdmin,
    refetchInterval: (query) => {
      const rows = query.state.data || [];
      const live = rows.some((row) => row.status === 'queued' || row.status === 'sending');
      return live ? 3000 : 30000;
    },
  });

  const failuresQuery = useQuery({
    queryKey: ['admin', 'push-broadcast-failures', failureId],
    queryFn: () => listRecipientFailures(failureId!),
    enabled: isAdmin && !!failureId,
  });

  useEffect(() => {
    if (!isAdmin || platforms.length === 0) {
      setAudience(null);
      return;
    }
    setAudienceLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        setAudience(await countAudience(platforms, subscription));
      } catch {
        setAudience(null);
      } finally {
        setAudienceLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [isAdmin, platforms, subscription]);

  async function ensureDraft(): Promise<string> {
    if (!title.trim() || !body.trim()) {
      throw new Error('Title and body are required');
    }
    if (platforms.length === 0) {
      throw new Error('Select at least one platform');
    }
    if (draftId) {
      await updateBroadcastDraft(draftId, draft);
      return draftId;
    }
    const created = await createBroadcastDraft(draft);
    setDraftId(created.id);
    return created.id;
  }

  const saveMutation = useMutation({
    mutationFn: ensureDraft,
    onSuccess: () => {
      toast.success('Draft saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'push-broadcasts'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureDraft();
      return testSendBroadcast(id);
    },
    onSuccess: (data) => {
      toast.success(`Test sent to ${data.tokens_succeeded ?? 0} of ${data.tokens ?? 0} of your devices`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'push-broadcasts'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Test send failed', { duration: 8000 }),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureDraft();
      return sendBroadcastNow(id);
    },
    onSuccess: () => {
      toast.success('Broadcast queued');
      setConfirmOpen(false);
      setConfirmText('');
      setDraftId(null);
      setTitle('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'push-broadcasts'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!scheduledLocal) throw new Error('Pick a schedule time');
      const when = new Date(scheduledLocal);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        throw new Error('Schedule time must be in the future');
      }
      const id = await ensureDraft();
      return scheduleBroadcast(id, when.toISOString());
    },
    onSuccess: () => {
      toast.success('Broadcast scheduled');
      setDraftId(null);
      setTitle('');
      setBody('');
      setScheduledLocal('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'push-broadcasts'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBroadcast,
    onSuccess: () => {
      toast.success('Broadcast canceled');
      queryClient.invalidateQueries({ queryKey: ['admin', 'push-broadcasts'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function togglePlatform(platform: PushPlatform, checked: boolean) {
    setPlatforms((current) => {
      if (checked) return current.includes(platform) ? current : [...current, platform];
      return current.filter((item) => item !== platform);
    });
  }

  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/home" replace />;

  const users = audience?.users ?? 0;
  const tokens = audience?.tokens ?? 0;
  const confirmMatches = confirmText.trim() === String(users);
  const rows = listQuery.data || [];

  return (
    <div className="min-h-screen relative bg-black/30 backdrop-blur-sm p-6 overflow-hidden rounded-3xl">
      <div className="max-w-[95vw] mx-auto space-y-8 px-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl shadow-lg">
            <Bell className="w-8 h-8 text-blue-300" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">Push Notifications</h1>
            <p className="text-white/80 mt-1">Compose, test, schedule, and broadcast to registered devices</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="border-white/20" style={glassStyle}>
            <CardHeader>
              <CardTitle className="text-white">Compose</CardTitle>
              <CardDescription className="text-white/70">
                Content freezes once a broadcast leaves draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex justify-between">
                  Title
                  <span className="text-white/40 text-xs">{title.length}/{TITLE_MAX}</span>
                </label>
                <Input
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tonight's card is live"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white flex justify-between">
                  Body
                  <span className="text-white/40 text-xs">{body.length}/{BODY_MAX}</span>
                </label>
                <Textarea
                  value={body}
                  maxLength={BODY_MAX}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Tap to open today's outliers."
                  className="min-h-[100px] bg-black/20 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Deep link</label>
                <Select value={route} onValueChange={(value) => setRoute(value as PushDeepLinkRoute)}>
                  <SelectTrigger className="bg-black/20 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PUSH_DEEP_LINK_ROUTES.map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Targeting</label>
                <div className="flex items-center gap-6">
                  {(['ios', 'android'] as PushPlatform[]).map((platform) => (
                    <label key={platform} className="flex items-center gap-2 text-white/80 text-sm">
                      <Checkbox
                        checked={platforms.includes(platform)}
                        onCheckedChange={(checked) => togglePlatform(platform, checked === true)}
                      />
                      {platform === 'ios' ? 'iOS' : 'Android'}
                    </label>
                  ))}
                </div>
                <Select
                  value={subscription}
                  onValueChange={(value) => setSubscription(value as PushSubscriptionFilter)}
                >
                  <SelectTrigger className="bg-black/20 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subscriptions</SelectItem>
                    <SelectItem value="pro">Pro only</SelectItem>
                    <SelectItem value="free">Free only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-white/70">
                  {audienceLoading
                    ? 'Counting recipients…'
                    : `Will reach ${users.toLocaleString()} users across ${tokens.toLocaleString()} devices`}
                  {audience && audience.opted_out > 0 ? ` · ${audience.opted_out} opted out` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="border-white/20 text-white"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save draft
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
                  Send to my devices
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 pt-2">
                <Input
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                  className="bg-black/20 border-white/20 text-white"
                />
                <Button
                  variant="outline"
                  className="border-white/20 text-white"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending}
                >
                  {scheduleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}
                  Schedule
                </Button>
              </div>
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setConfirmOpen(true)}
                disabled={!title.trim() || !body.trim() || platforms.length === 0}
              >
                <Send className="w-4 h-4 mr-2" />
                Send to everyone
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <PreviewCard title="iOS" subtitle="wagerproof://{route}" heading={title} body={body} route={route} />
            <PreviewCard title="Android" subtitle="channel wagerproof_updates" heading={title} body={body} route={route} />
          </div>
        </div>

        <Card className="border-white/20" style={glassStyle}>
          <CardHeader>
            <CardTitle className="text-white">History</CardTitle>
            <CardDescription className="text-white/70">
              Refreshes every 3s while a send is in flight.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {listQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-white/70" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-white/60 text-sm">No broadcasts yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60">Title</TableHead>
                    <TableHead className="text-white/60">Status</TableHead>
                    <TableHead className="text-white/60">Audience</TableHead>
                    <TableHead className="text-white/60">Progress</TableHead>
                    <TableHead className="text-white/60">When</TableHead>
                    <TableHead className="text-white/60 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <HistoryRow
                      key={row.id}
                      row={row}
                      onCancel={() => cancelMutation.mutate(row.id)}
                      canceling={cancelMutation.isPending}
                      onFailures={() => setFailureId(row.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-zinc-950 border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Send to everyone?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              This will send “{title || 'this notification'}” to {users.toLocaleString()} users
              ({tokens.toLocaleString()} devices). Type <span className="font-mono text-white">{users}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={String(users)}
            className="bg-black/20 border-white/20 text-white"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={!confirmMatches || sendMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                sendMutation.mutate();
              }}
            >
              {sendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Send now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!failureId} onOpenChange={(open) => { if (!open) setFailureId(null); }}>
        <DialogContent className="bg-zinc-950 border-white/20 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Failed recipients</DialogTitle>
            <DialogDescription className="text-white/70">
              Up to 100 most recent failures for this broadcast.
            </DialogDescription>
          </DialogHeader>
          {failuresQuery.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (failuresQuery.data || []).length === 0 ? (
            <p className="text-sm text-white/60">No failures recorded.</p>
          ) : (
            <div className="max-h-80 overflow-auto space-y-2">
              {(failuresQuery.data || []).map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 p-3 text-sm">
                  <p className="font-mono text-white/80">{item.user_id}</p>
                  <p className="text-white/60 mt-1">{item.status}: {item.skip_reason || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewCard({
  title,
  subtitle,
  heading,
  body,
  route,
}: {
  title: string;
  subtitle: string;
  heading: string;
  body: string;
  route: string;
}) {
  return (
    <Card className="border-white/20" style={glassStyle}>
      <CardHeader>
        <CardTitle className="text-white text-lg">{title} preview</CardTitle>
        <CardDescription className="text-white/60">{subtitle.replace('{route}', route)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
          <p className="text-sm font-semibold text-white">{heading || 'Notification title'}</p>
          <p className="text-sm text-white/70 mt-1">{body || 'Notification body'}</p>
          <p className="text-[11px] uppercase tracking-wide text-white/40 mt-3">Opens {route}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryRow({
  row,
  onCancel,
  canceling,
  onFailures,
}: {
  row: PushBroadcastStatusRow;
  onCancel: () => void;
  canceling: boolean;
  onFailures: () => void;
}) {
  const total = row.recipients_total || 0;
  const done = row.sent_count + row.skipped_count + row.failed_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : row.status === 'sent' ? 100 : 0;
  const canCancel = ['draft', 'scheduled', 'queued', 'sending'].includes(row.status);

  return (
    <TableRow className="border-white/10">
      <TableCell className="text-white">
        <div className="font-medium">{row.title}</div>
        <div className="text-xs text-white/50 mt-0.5">{row.deep_link_route} · {(row.target_platforms || []).join(', ')} · {row.target_subscription}</div>
      </TableCell>
      <TableCell>{statusBadge(row.status)}</TableCell>
      <TableCell className="text-white/80 text-sm">{(row.recipients_total ?? 0).toLocaleString()}</TableCell>
      <TableCell className="min-w-[160px]">
        <Progress value={pct} className="h-2 bg-white/10" />
        <p className="text-[11px] text-white/50 mt-1">
          {row.sent_count} sent · {row.failed_count} failed · {row.skipped_count} skipped
        </p>
      </TableCell>
      <TableCell className="text-white/70 text-sm">
        {row.status === 'scheduled' ? formatWhen(row.scheduled_for) : formatWhen(row.updated_at)}
      </TableCell>
      <TableCell className="text-right space-x-2">
        {(row.failed_count > 0 || row.retryable_count > 0) && (
          <Button size="sm" variant="ghost" className="text-white/70" onClick={onFailures}>
            Failures
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="ghost" className="text-red-300" onClick={onCancel} disabled={canceling}>
            Cancel
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
